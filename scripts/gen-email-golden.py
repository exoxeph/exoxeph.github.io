"""Golden outputs for the Bench email validation port.

Usage (no network): python scripts/gen-email-golden.py [path-to-email-assistant-repo]
Runs the repository's real validate_request over a grid of inputs and writes
tests/fixtures/email/golden.json (inputs, validity, exact message, pydantic version, repo commit).
"""
import itertools, json, subprocess, sys, pathlib

repo = pathlib.Path(sys.argv[1])
sys.path.insert(0, str(repo))
import pydantic
from model_b_approach.pipeline import validate_request, InputValidationError
from src.schemas import Tone

intents = ["", " ", "\t\n", "\x1c", "\x85", "\ufeff", "\u00a0", "Follow up on the sync", "  padded  "]
facts = [[], [""], [" "], ["", "  "], ["\x1c"], ["\ufeff"], ["Priya reviews by Friday"], ["a", ""], ["a", "b", "c"], ["x"] * 6]
tones = [t.value for t in Tone] + ["rude", "", "Formal"]
cases = []
for intent, f, tone in itertools.product(intents, facts, tones):
    try:
        validate_request(intent, f, tone)
        cases.append({"intent": intent, "keyFacts": f, "tone": tone, "valid": True, "message": ""})
    except InputValidationError as e:
        cases.append({"intent": intent, "keyFacts": f, "tone": tone, "valid": False, "message": str(e)})
commit = subprocess.run(["git", "-C", str(repo), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
dest = pathlib.Path(__file__).resolve().parent.parent / "tests/fixtures/email/golden.json"
dest.write_text(json.dumps({"repositoryCommit": commit, "pydantic": pydantic.VERSION, "tones": [t.value for t in Tone], "cases": cases}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print("wrote", dest, len(cases), "cases; invalid:", sum(not c["valid"] for c in cases))
