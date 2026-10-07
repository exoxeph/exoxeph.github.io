"""Execute the read-only Data-Aware-RAG router with local test doubles.

Run: python scripts/gen-rag-golden.py. No network or third party packages are used.
Only import-time dependencies are stubbed; router_dag.run_plan and exec_repair run unchanged.
"""
import csv
import json
import shutil
import subprocess
import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = Path('G:/exoxeph/repos/Data-Aware-RAG')
sys.path.insert(0, str(REPO))
prune_calls = []

def stub(name, **members):
    module = types.ModuleType(name)
    module.__dict__.update(members)
    sys.modules[name] = module

class Placeholder:
    pass

def sentence_prune(query, text, min_overlap):
    prune_calls.append(min_overlap)
    return text

stub('rag_papers.retrieval.ensemble_retriever', EnsembleRetriever=Placeholder)
stub('rag_papers.index.contextualize', contextualize=lambda texts, query, max_length: ' '.join(texts)[:max_length])
stub('rag_papers.generation.generator', BaseGenerator=Placeholder)
stub('rag_papers.generation.prompts', QueryProcessor=Placeholder)
stub('rag_papers.generation.verifier', ResponseVerifier=Placeholder)
stub('rag_papers.retrieval.prune_sentences', sentence_prune=sentence_prune)
stub('rag_papers.eval.telemetry', new_run_id=lambda: 'golden', log_step=lambda **kwargs: None,
     persist_duckdb=lambda *args: None, write_csv=lambda *args: None, write_parquet=lambda *args: None)
from rag_papers.retrieval import router_dag as router
from rag_papers.eval.schemas import EvalDataset, EvalItem
from rag_papers.eval.runner import evaluate_dataset
generate_calls = []
real_generate = router.exec_generate
def record_generate(ctx, generator, template, temperature, **kwargs):
    generate_calls.append({'template': template, 'temperature': temperature})
    return real_generate(ctx, generator, template, temperature, **kwargs)
router.exec_generate = record_generate

class Retriever:
    def __init__(self):
        self.calls = []
    def search(self, query, **kwargs):
        self.calls.append(kwargs)
        return [('Research context.', 1.0, {})]

class Generator:
    def __init__(self):
        self.prompts = []
    def generate(self, prompt, config=None):
        self.prompts.append(prompt)
        return types.SimpleNamespace(text='Draft answer.')

scores = [0, 0.5, 0.65, 0.7, 0.71, 0.719, 0.72, 0.721, 0.73, 0.8, 1.0]
thresholds = [0.5, 0.72, 0.9]
cases = []
for threshold in thresholds:
    for score in scores:
        cfg = router.Stage4Config(accept_threshold=threshold)
        retriever, generator = Retriever(), Generator()
        prune_calls.clear()
        generate_calls.clear()
        verifies = iter([score, score])
        router.score_answer = lambda answer, context, query: {'score': next(verifies)}
        dataset = EvalDataset(name='golden', items=[EvalItem(id='q3', query='Compare CNNs and Transformers', intent='comparison')])
        result = evaluate_dataset(dataset, retriever, generator, cfg, run_id='golden').results[0]
        repaired = len(retriever.calls) > 1
        cases.append({
            'draftScore': score, 'threshold': threshold,
            'repaired': repaired, 'accepted': result.accepted,
            'finalScore': result.verify_score,
            'repairSearch': retriever.calls[1] if repaired else None,
            'repairPruneOverlap': prune_calls[1] if repaired else None,
            'repairTemplate': generate_calls[0]['template'] if repaired else None,
            'repairTemperature': generate_calls[0]['temperature'] if repaired else None,
        })

commit = subprocess.check_output(['git', '-c', f'safe.directory={REPO}', '-C', str(REPO), 'rev-parse', 'HEAD'], text=True).strip()
destination = ROOT / 'tests/fixtures/rag'
destination.mkdir(parents=True, exist_ok=True)
(destination / 'golden.json').write_text(json.dumps({'commit': commit, 'cases': cases}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for source in (REPO / 'runs').glob('*/results.csv'):
    shutil.copyfile(source, destination / f'{source.parent.name}_results.csv')
print(f'{len(cases)} executed cases, {len(list(destination.glob("*_results.csv")))} run files, {commit}')
