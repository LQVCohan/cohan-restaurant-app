from base64 import b64decode
from gzip import decompress
from hashlib import sha256
from pathlib import Path

parts = sorted(Path("scripts/.schedule-ui-patch").glob("part-*.txt"))
if len(parts) != 8:
    raise RuntimeError(f"Expected 8 schedule patch parts, found {len(parts)}")
for part in parts:
    value = part.read_text(encoding="utf-8").strip().encode("ascii")
    print(part.name, len(value), sha256(value).hexdigest(), flush=True)
payload = "".join(part.read_text(encoding="utf-8").strip() for part in parts).encode("ascii")
print("payload", len(payload), sha256(payload).hexdigest(), flush=True)
source = decompress(b64decode(payload)).decode("utf-8")
exec(compile(source, "apply_schedule_ui_data_integrity", "exec"))
