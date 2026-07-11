$ErrorActionPreference = "Stop"
python -m pip install pyyaml jsonschema pillow
python .governance/enforce_coding_policy_v1_0.py --dir .governance --profile .governance/projects/ds-mcp/project-profile.yaml --report .governance/package-report.json
