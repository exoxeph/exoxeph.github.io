"""Generate speech parser goldens from the read-only Python repository.

Run: python scripts/gen-speech-golden.py
Requires G:/exoxeph/repos/speech-doc-extraction locally. No network is used.
The fixture records the source commit so changes in the Python parser are visible.
"""
import dataclasses
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = Path('G:/exoxeph/repos/speech-doc-extraction')
sys.path.insert(0, str(REPO))
from app.services.report_parser import parse_lab_result_row, parse_lab_result_rows

names = ['report_01_standard.txt', 'report_02_complex.txt', 'report_03_alternate_layout.txt', 'report_04_normalization_edge_cases.txt', 'non_lab_receipt.txt']
files = {name: (REPO / 'testdata/reports/source_text' / name).read_text(encoding='utf-8').splitlines() for name in names}
files['synthetic_multiline.txt'] = [
 '* Glucose [Mass/volume] in Serum',
 '  observed value: 84.2 mg/dL reference range: 70 - 100',
 '* Urea [Mass/volume] in Serum',
 '  value=16.7 unit=mg/dL; range=N/A',
 '* Creatinine [Mass/volume] in Serum',
 '  value=not-a-number unit=mg/dL; range=N/A',
 'Sodium 142 mmol/L 135-145 N/A',
]
extras = [
 'RP                    <8.5            mg/dL         <1.0                 N/A',
 'Cell Count            1.2 x 1043      10^3/µL       1.0 - 2.0            N/A',
 'Cell Count            1.2 x 10^3      10^3/µL       1.0 - 2.0            N/A',
 'Hemoglobin            10.5            g/dL          12.0 - 16.0          L',
 'CRP                   <0.5            mg/dL         <1.0                 N/A',
 'Platelet Count        12,500          10^3/µL       10,000 - 15,000      N/A',
 'Glucose               180             mg/dL         70 - 100             H',
 'Albumin               3.7             gm/dl         3.5 - 5.0            N/A',
 '', ' ', '\t', 'N/A', 'Test Name | Value | Unit | Range | Flag', '---|---|---',
 'Glucose | 180 | mg/dL | 70 - 100 | H', 'CRP|<0.5|mg/dl|<1.0|N/A',
 'Glucose 180 mg/dL 70-100 H', 'Platelet Count 12,500 10^3/µL 10,000-15,000 N/A',
 'CRP <0.5 mg/dL <1.0 N/A', 'Sodium 142 mmol/L 135-145 N/A',
 'Glucose  ١٢  mg/dL  0-20', 'Glucose  12,500  mg/dL  0-20000',
 'Glucose  1,5  mg/dL  0 - 2', 'Glucose  1.2 x 10^3  mg/dL  0 - 2000',
 'Glucose  1.2 x 103  mg/dL  0 - 2000', 'Glucose  1.2 * 10^3  mg/dL  0 - 2000',
 'Glucose  @.5  mg/dL  0 - 2', 'Glucose  ©.5  mg/dL  0 - 2',
]
values = ['0', '-0.5', '+1.25', '<8.5', '>= 2', '<=+3', '1,000', '10,000.25', '1,25', '1.2 - 2.4', '1.2-2.4', '1.2 x 10^3', '1.2 X 10^3', '1.2 * 10^3', '1.2 x 1043', 'N/A', 'none', '12@3', '©5', '©5', '٣', '1e3', '< -2', '.5', '5.', '1,2,3', '1--2', '1.2 x 10^-3', '1.2 x 10^+3', ' 7 ', '1 2', '12/3', '1.2 - -2.3', '0.0001', '999999', '4,567,890', '4,56', '5*10^2', '5x10^2', '5 x 10^2', '6.2', '>90']
extras += [f'Edge {i}  {value}  gm/dl  N/A  N/A' for i,value in enumerate(values)]
extras += ['* Glucose [Mass/volume] in Serum', '  value=84.2; unit=mg/dL; range=N/A', '  observed value: 84.2 mg/dL reference range: 70 - 100']
corpus = [line for lines in files.values() for line in lines] + extras
to_dict = lambda x: dataclasses.asdict(x) if x is not None else None
golden = {
 'commit': subprocess.check_output(['git','-c',f'safe.directory={REPO}','-C',str(REPO),'rev-parse','HEAD'], text=True).strip(),
 'corpus': corpus,
 'per_line': [to_dict(parse_lab_result_row(line)) for line in corpus],
 'files': [{'name':name,'lines':lines,'results':[to_dict(x) for x in parse_lab_result_rows(lines)]} for name,lines in files.items()],
}
path = ROOT / 'tests/fixtures/speech/golden.json'
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(golden, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'{len(corpus)} lines, {len(files)} files, {path}')
