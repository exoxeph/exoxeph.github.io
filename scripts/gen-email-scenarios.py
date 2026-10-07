"""Extract the committed email-assistant scenarios and recorded outcomes for the Bench.

Usage (no network): python scripts/gen-email-scenarios.py [path-to-email-assistant-repo]
Reads data/test_scenarios.json and data/evaluation_results.json and writes
src/data/bench/email-scenarios.json with only: id, name, type, intent, keyFacts, tone,
expectedClarify, recordedGated, recordedBaseline. No email bodies, no judge text, no scores.
"""
import json, subprocess, sys, pathlib

repo = pathlib.Path(sys.argv[1])
scenarios = json.loads((repo / "data/test_scenarios.json").read_text(encoding="utf-8"))
results = json.loads((repo / "data/evaluation_results.json").read_text(encoding="utf-8"))["results"]
kind = {(r["scenario_id"], r["model_name"]): r["output_kind"] for r in results}

def expects_clarify(text: str) -> bool:
    t = text.lower()
    return "ask for clarification" in t or "status should be 'clarify'" in t

out = []
for s in scenarios:
    i = s["scenario_id"]
    out.append({
        "id": i,
        "name": s["scenario_name"],
        "type": s["scenario_type"],
        "intent": s["intent"],
        "keyFacts": s["key_facts"],
        "tone": s["tone"],
        "expectedClarify": expects_clarify(s["expected_behavior"]),
        "recordedGated": kind[(i, "advanced_pipeline")],
        "recordedBaseline": kind[(i, "baseline_prompt")],
    })
assert [s["id"] for s in out if s["expectedClarify"]] == [3, 4, 7], [s["id"] for s in out if s["expectedClarify"]]
commit = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
dest = pathlib.Path(__file__).resolve().parent.parent / "src/data/bench/email-scenarios.json"
dest.write_text(json.dumps({"repositoryCommit": commit, "scenarios": out}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("wrote", dest, len(out), "scenarios")
