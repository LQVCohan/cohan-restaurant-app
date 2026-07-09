# Follow-up: skip broken mongod candidates

## Observation

On a Windows machine with both MongoDB 8.3 and 7.0 installed, `npm run db` discovered the 8.3 binary first. The 8.3 binary printed the startup banner from the runner, then exited immediately, so the backend test still failed with `ECONNREFUSED 127.0.0.1:27017`.

## Root cause

The runner selected the highest installed binary by path existence only. It did not verify that the selected `mongod` binary can actually execute on the machine before trying to start it.

## Fix plan

Validate discovered `mongod` candidates with `--version` before choosing one. When an installed binary fails to run, skip it and fall back to the next installed version, unless `MONGOD_BIN` was explicitly provided.
