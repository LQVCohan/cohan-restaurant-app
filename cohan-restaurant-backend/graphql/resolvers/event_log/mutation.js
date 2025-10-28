import EventLog from "../../../models/event-log.model.js";

export default {
  async createEventLog(_, { input }, ctx) {
    // (tùy nhu cầu) có thể enforce actor từ ctx.user
    const doc = await EventLog.create({
      ...input,
      at: input.at ? new Date(input.at) : new Date(),
    });
    return await EventLog.findById(doc._id).lean({ virtuals: true });
  },
};
