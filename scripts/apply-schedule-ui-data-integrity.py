from base64 import b64decode
from gzip import decompress
from pathlib import Path

parts = sorted(Path("scripts/.schedule-ui-patch").glob("part-*.txt"))
if len(parts) != 8:
    raise RuntimeError(f"Expected 8 schedule patch parts, found {len(parts)}")
payload = "".join(part.read_text(encoding="utf-8").strip() for part in parts)
source = decompress(b64decode(payload)).decode("utf-8")
exec(compile(source, "apply_schedule_ui_data_integrity", "exec"))
