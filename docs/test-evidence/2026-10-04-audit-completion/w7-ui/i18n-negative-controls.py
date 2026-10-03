from pathlib import Path
import json
import subprocess
import tempfile

root = Path(__file__).resolve().parents[4]
audit = root / "scripts/i18n-audit.ts"
cases = [
    ("exact programmer invariant", "app/i18n/client.tsx", 'export function invariant() { throw new RangeError("Display number must be finite"); }', 0),
    ("same text rendered in JSX", "app/i18n/client.tsx", 'export const Message = () => <p>{"Display number must be finite"}</p>;', 1),
    ("different RangeError message", "app/i18n/client.tsx", 'export function invariant() { throw new RangeError("Choose a valid number"); }', 1),
    ("same invariant in another module", "app/features/buyer/Invariant.tsx", 'export function invariant() { throw new RangeError("Display number must be finite"); }', 1),
]
results = []
for name, file, source, expected in cases:
    with tempfile.TemporaryDirectory(prefix="marketplace-i18n-audit-") as scratch:
        fixture = Path(scratch).resolve()
        if not fixture.is_relative_to(Path(tempfile.gettempdir()).resolve()):
            raise RuntimeError("Fixture escaped the designated temporary directory")
        for locale, text in [("en", "Test"), ("th", "ทดสอบ")]:
            target = fixture / "messages" / f"{locale}.json"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps({"common": {"test": text}}, ensure_ascii=False), encoding="utf8")
        target = fixture / file
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(source, encoding="utf8")
        process = subprocess.run(["bun", str(audit)], cwd=fixture, capture_output=True, text=True, encoding="utf8")
        results.append({"case": name, "expectedExit": expected, "actualExit": process.returncode, "stdout": process.stdout, "stderr": process.stderr})
        if process.returncode != expected:
            raise RuntimeError(f"Audit control failed: {name}: expected {expected}, received {process.returncode}")
out = Path(__file__).with_name("i18n-negative-controls.json")
out.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
print(f"All {len(results)} audit negative controls passed")
