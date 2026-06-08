import mongoose from "mongoose";
import dayjs from "dayjs";
import { PaymentSession, PaymentTransaction } from "../../../models/index.js";

const DEFAULT_TOLERANCE = 1;
const DEFAULT_WINDOW_HOURS = 24;
const MIN_TOKEN_LENGTH = 8;
const MAX_CANDIDATES = 8;

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalize = (value) => String(value || "").trim();
const lower = (value) => normalize(value).toLowerCase();
const amountMatches = (a, b, tolerance = DEFAULT_TOLERANCE) => Math.abs(Number(a || 0) - Number(b || 0)) <= tolerance;

function extractTokens(bankTransaction = {}) {
  const raw = `${bankTransaction.transferContent || ""} ${bankTransaction.description || ""} ${bankTransaction.transactionId || ""}`;
  return Array.from(new Set(raw.split(/[^A-Za-z0-9_-]+/).map((x) => x.trim()).filter((x) => x.length >= MIN_TOKEN_LENGTH)));
}

function dateWindow(bankTransaction = {}, windowHours = DEFAULT_WINDOW_HOURS) {
  const center = bankTransaction.occurredAt || bankTransaction.createdAt || new Date();
  return {
    from: dayjs(center).subtract(windowHours, "hour").toDate(),
    to: dayjs(center).add(windowHours, "hour").toDate(),
  };
}

function buildSessionCandidate(session, bankTransaction, reasonPrefix, token = null) {
  const expectedAmount = Number(session.amount || 0);
  const receivedAmount = Number(bankTransaction.amount || 0);
  const exactAmount = amountMatches(expectedAmount, receivedAmount);
  const confidence = reasonPrefix === "exact_reference"
    ? exactAmount ? 100 : 92
    : exactAmount ? 86 : 72;
  return {
    kind: "PaymentSession",
    id: String(session._id),
    paymentSessionId: session._id,
    expectedAmount,
    receivedAmount,
    confidence,
    reason: `${reasonPrefix}${token ? `:${token}` : ""}${exactAmount ? ":amount_match" : ":amount_mismatch"}`,
    reference: session.reference || session.requestId || "",
    occurredAt: session.updatedAt || session.createdAt,
  };
}

function buildTransactionCandidate(transaction, bankTransaction, reasonPrefix, token = null) {
  const expectedAmount = Number(transaction.paidAmount || 0);
  const receivedAmount = Number(bankTransaction.amount || 0);
  const exactAmount = amountMatches(expectedAmount, receivedAmount);
  const confidence = reasonPrefix === "exact_transaction_ref"
    ? exactAmount ? 100 : 90
    : exactAmount ? 82 : 68;
  return {
    kind: "PaymentTransaction",
    id: String(transaction._id),
    paymentTransactionId: transaction._id,
    expectedAmount,
    receivedAmount,
    confidence,
    reason: `${reasonPrefix}${token ? `:${token}` : ""}${exactAmount ? ":amount_match" : ":amount_mismatch"}`,
    reference: transaction.externalRef || transaction.txnRef || "",
    occurredAt: transaction.paidAt || transaction.createdAt,
  };
}

function sortCandidates(candidates = []) {
  return candidates
    .sort((a, b) => b.confidence - a.confidence || Math.abs((a.expectedAmount || 0) - (a.receivedAmount || 0)) - Math.abs((b.expectedAmount || 0) - (b.receivedAmount || 0)))
    .slice(0, MAX_CANDIDATES);
}

export async function findReconciliationCandidates(bankTransaction, options = {}) {
  const restaurantId = bankTransaction?.restaurantId;
  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) {
    return { candidates: [], tokens: [], reason: "invalid_restaurant" };
  }
  const tokens = extractTokens(bankTransaction);
  const { from, to } = dateWindow(bankTransaction, options.windowHours || DEFAULT_WINDOW_HOURS);
  const candidates = [];
  const seen = new Set();

  if (!tokens.length) return { candidates: [], tokens, reason: "no_reliable_reference_token" };

  for (const token of tokens) {
    const exactSessions = await PaymentSession.find({ restaurantId, reference: token, createdAt: { $gte: from, $lte: to } }).limit(3).lean();
    for (const session of exactSessions) {
      const key = `session:${session._id}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(buildSessionCandidate(session, bankTransaction, "exact_reference", token));
      }
    }

    const exactTransactions = await PaymentTransaction.find({
      restaurantId,
      paidAt: { $gte: from, $lte: to },
      $or: [{ externalRef: token }, { txnRef: token }],
    }).limit(3).lean();
    for (const transaction of exactTransactions) {
      const key = `transaction:${transaction._id}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(buildTransactionCandidate(transaction, bankTransaction, "exact_transaction_ref", token));
      }
    }
  }

  if (candidates.length) return { candidates: sortCandidates(candidates), tokens, reason: "exact_reference_candidates" };

  for (const token of tokens.filter((t) => t.length >= 10).slice(0, 4)) {
    const re = new RegExp(escapeRegex(token), "i");
    const fuzzySessions = await PaymentSession.find({
      restaurantId,
      amount: { $gte: Number(bankTransaction.amount || 0) - DEFAULT_TOLERANCE, $lte: Number(bankTransaction.amount || 0) + DEFAULT_TOLERANCE },
      createdAt: { $gte: from, $lte: to },
      reference: re,
    }).limit(3).lean();
    for (const session of fuzzySessions) {
      const key = `session:${session._id}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(buildSessionCandidate(session, bankTransaction, "fuzzy_reference", token));
      }
    }

    const fuzzyTransactions = await PaymentTransaction.find({
      restaurantId,
      paidAmount: { $gte: Number(bankTransaction.amount || 0) - DEFAULT_TOLERANCE, $lte: Number(bankTransaction.amount || 0) + DEFAULT_TOLERANCE },
      paidAt: { $gte: from, $lte: to },
      $or: [{ externalRef: re }, { txnRef: re }],
    }).limit(3).lean();
    for (const transaction of fuzzyTransactions) {
      const key = `transaction:${transaction._id}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(buildTransactionCandidate(transaction, bankTransaction, "fuzzy_transaction_ref", token));
      }
    }
  }

  return { candidates: sortCandidates(candidates), tokens, reason: candidates.length ? "fuzzy_candidates" : "no_candidate" };
}

export function chooseAutoMatch(candidates = []) {
  const best = sortCandidates(candidates)[0] || null;
  if (!best || best.confidence < 80) return null;
  return best;
}

export function serializeCandidates(candidates = []) {
  return candidates.map((candidate) => ({
    kind: candidate.kind,
    id: String(candidate.id),
    paymentSessionId: candidate.paymentSessionId ? String(candidate.paymentSessionId) : null,
    paymentTransactionId: candidate.paymentTransactionId ? String(candidate.paymentTransactionId) : null,
    expectedAmount: candidate.expectedAmount,
    receivedAmount: candidate.receivedAmount,
    confidence: candidate.confidence,
    reason: candidate.reason,
    reference: candidate.reference,
    occurredAt: candidate.occurredAt,
  }));
}
