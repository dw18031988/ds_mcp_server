#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, re, sys, zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import yaml
except Exception:
    yaml = None
try:
    import jsonschema
except Exception:
    jsonschema = None

CANONICAL = "Coding_Project_Governance_v1.0.md"
MANIFEST = "policy_manifest.v1.0.json"
CRITICAL_IDS = [
    "TRUST-01","TRUST-02","TRUST-03","TRUST-04","TRUST-06",
    "GATE-01","GATE-02","GATE-03","GATE-04","GATE-05",
    "PROFILE-01","PROFILE-02","PROFILE-03","PROFILE-04",
    "PRE-02","PRE-03","PRE-04","PRE-05",
    "GH-02","GH-03","CMD-01","CMD-02","CMD-03","CMD-04","CMD-05",
    "DATA-01","DATA-02","DATA-03","SEC-01","SEC-02",
    "VAL-04","VAL-05","PR-02","CI-01","CI-02","CI-03","CI-04","CI-05",
    "POLICY-01","POLICY-02","POLICY-03","POLICY-04","POLICY-05","BAN-01"
]

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def front_matter(text: str) -> dict[str, Any]:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}
    raw = text[4:end]
    if yaml is not None:
        try:
            value = yaml.safe_load(raw)
            return value if isinstance(value, dict) else {}
        except Exception:
            pass
    out: dict[str, Any] = {}
    for line in raw.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip().strip('"')
    return out

def load_structured(path: Path) -> Any:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        return json.loads(text)
    if yaml is None:
        raise RuntimeError("PyYAML is required")
    return yaml.safe_load(text)

def validate_schema(instance: Any, schema: dict[str, Any]) -> tuple[bool, str]:
    if jsonschema is None:
        return False, "jsonschema dependency unavailable"
    try:
        jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker()).validate(instance)
        return True, "schema validation passed"
    except Exception as exc:
        return False, str(exc).splitlines()[0]

def canonical_scope_hash(envelope: dict[str, Any]) -> str:
    clean = dict(envelope)
    clean.pop("scope_hash", None)
    payload = json.dumps(clean, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()

def parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z","+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

def add(results: list[dict[str,str]], cid: str, ok: bool|None, detail: str) -> None:
    status = "SKIP" if ok is None else ("PASS" if ok else "FAIL")
    results.append({"check":cid,"status":status,"detail":detail})

def validate_svg(path: Path) -> tuple[bool,str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    lower = text.lower()
    prohibited = ["<script","foreignobject","javascript:","data:text/html","href=\"http","href='http",
                  "xlink:href=\"http","xlink:href='http","onload=","onclick=","onerror="]
    found = [x for x in prohibited if x in lower]
    dims = all(x in lower for x in ["<svg","width=","height=","viewbox="])
    return dims and not found, f"dimensions={dims}; prohibited={found}"

def gate_actions_valid(gate: str, actions: set[str]) -> bool:
    high = {"merge_approved_pr","deploy_approved_release","production_data_write","production_config_change","credential_rotation"}
    if gate in {"G2_EXECUTION","G3_PR"}:
        return not (actions & high)
    if gate == "G4_MERGE":
        return actions == {"merge_approved_pr"}
    if gate == "G5_DEPLOY":
        return actions == {"deploy_approved_release"}
    if gate == "G6_PRODUCTION_DATA":
        return bool(actions) and actions.issubset({"production_data_write","production_config_change","credential_rotation"})
    return False

def main() -> int:
    p = argparse.ArgumentParser(description="Validate generic coding governance, project profiles, and optional task artifacts.")
    p.add_argument("--dir", default=".")
    p.add_argument("--profile")
    p.add_argument("--approval-envelope")
    p.add_argument("--change-plan")
    p.add_argument("--mermaid")
    p.add_argument("--svg")
    p.add_argument("--png")
    p.add_argument("--report", default="enforcement_report.v1.0.json")
    args = p.parse_args()
    root = Path(args.dir)
    results: list[dict[str,str]] = []

    # Package and canonical.
    manifest_path = root / MANIFEST
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"FAIL: manifest unreadable: {exc}", file=sys.stderr)
        return 2

    for schema_name, instance, cid in [
        ("policy_manifest.schema.json", manifest, "SCHEMA-MANIFEST"),
    ]:
        try:
            schema = json.loads((root/schema_name).read_text(encoding="utf-8"))
            ok, detail = validate_schema(instance, schema)
        except Exception as exc:
            ok, detail = False, str(exc)
        add(results,cid,ok,detail)

    canonical = root / manifest.get("canonical_file","")
    add(results,"META-01",canonical.exists(),f"canonical={canonical.name}")
    if not canonical.exists():
        return 1
    ctext = canonical.read_text(encoding="utf-8")
    cmeta = front_matter(ctext)
    csha = sha256(canonical)
    add(results,"META-02",cmeta.get("authoritative") is True,"canonical authoritative=true")
    add(results,"META-03",str(cmeta.get("version"))=="1.0","canonical version=1.0")
    add(results,"HASH-01",csha==manifest.get("canonical_sha256"),f"canonical sha={csha}")
    project_leaks = ["dw18031988/ds_mcp_server","nhatnguyenquang1838-coder/rental_home","ds-mcp-server-one.vercel.app","TO_BE_CONFIRMED/myskills"]
    found = [x for x in project_leaks if x in ctext]
    add(results,"CORE-GENERIC",not found,f"project-specific leaks={found}")
    for rid in manifest.get("critical_rule_ids", CRITICAL_IDS):
        add(results,f"RULE-{rid}",rid in ctext,f"{rid} present")
    add(results,"APPROVAL-EXACT","APPROVE <approval_id> <first-16-characters-of-scope_hash>" in ctext,"exact approval format")
    add(results,"PROFILE-BOUNDARY",all(x in ctext for x in ["PROFILE-01","PROFILE-03","tighten","PROJECT_PROFILE_INVALID"]),"profile controls")
    add(results,"VISUAL-OVERVIEW",all(x in ctext for x in ["Maximum 9 visible nodes total","Maximum 3 nodes per rank/row","Maximum 3 semantic ranks/rows"]),"Mermaid 3x3")
    add(results,"VISUAL-DETAIL",all(x in ctext for x in ["Maximum 36 visible detail nodes","Maximum 6 columns and 6 rows","orthogonal connectors"]),"detailed 6x6")

    # File existence and integrity.
    all_files = manifest.get("authoritative_files",[])+manifest.get("derived_files",[])+manifest.get("support_files",[])+manifest.get("project_profiles",[])
    for rel in all_files:
        add(results,"FILE-"+rel,(root/rel).exists(),f"{rel} exists")
    for rel, expected in manifest.get("file_sha256",{}).items():
        path = root/rel
        actual = sha256(path) if path.exists() else ""
        add(results,"FILEHASH-"+rel,path.exists() and actual==expected,f"expected={expected[:16]} actual={actual[:16] if actual else 'missing'}")

    # Schemas and all project profiles.
    try:
        profile_schema = json.loads((root/"project_profile.schema.json").read_text(encoding="utf-8"))
        extension_schema = json.loads((root/"project_extension.schema.json").read_text(encoding="utf-8"))
        approval_schema = json.loads((root/"approval_envelope.schema.json").read_text(encoding="utf-8"))
        plan_schema = json.loads((root/"change_plan.schema.json").read_text(encoding="utf-8"))
        if jsonschema is not None:
            for s in [profile_schema,extension_schema,approval_schema,plan_schema]:
                jsonschema.Draft202012Validator.check_schema(s)
        add(results,"SCHEMAS-ALL",True,"all schemas valid")
    except Exception as exc:
        add(results,"SCHEMAS-ALL",False,str(exc).splitlines()[0])
        profile_schema=extension_schema=approval_schema=plan_schema={}

    profile_paths = [root/x for x in manifest.get("project_profiles",[])]
    profiles: dict[str,dict[str,Any]] = {}
    for path in profile_paths:
        try:
            profile = load_structured(path)
            ok, detail = validate_schema(profile, profile_schema)
            add(results,"PROFILE-SCHEMA-"+path.parent.name,ok,detail)
            pid = profile.get("profile_id")
            profiles[pid] = profile
            repo = profile.get("repository",{})
            fail_closed = repo.get("identity_status") == "verified" or repo.get("write_enabled") is False
            add(results,"PROFILE-IDENTITY-"+path.parent.name,fail_closed,f"status={repo.get('identity_status')} write_enabled={repo.get('write_enabled')}")
            for ext_rel in profile.get("extensions",[]):
                ext_path = root/ext_rel
                meta = front_matter(ext_path.read_text(encoding="utf-8")) if ext_path.exists() else {}
                ok_ext, det_ext = validate_schema(meta, extension_schema) if ext_path.exists() else (False,"extension missing")
                add(results,"EXTENSION-"+path.parent.name,ok_ext and meta.get("extends_profile")==pid and meta.get("core_sha256")==csha,det_ext)
        except Exception as exc:
            add(results,"PROFILE-SCHEMA-"+path.parent.name,False,str(exc).splitlines()[0])

    # Active profile.
    active_profile = None
    if args.profile:
        try:
            active_path = Path(args.profile)
            active_profile = load_structured(active_path)
            ok,detail = validate_schema(active_profile,profile_schema)
            add(results,"ACTIVE-PROFILE-SCHEMA",ok,detail)
            repo=active_profile.get("repository",{})
            add(results,"ACTIVE-PROFILE-WRITE",repo.get("write_enabled") is True and repo.get("identity_status")=="verified",
                f"identity={repo.get('identity_status')} write_enabled={repo.get('write_enabled')}")
        except Exception as exc:
            add(results,"ACTIVE-PROFILE-SCHEMA",False,str(exc).splitlines()[0])
    else:
        add(results,"ACTIVE-PROFILE-SCHEMA",None,"no active profile supplied")

    # Optional task envelope.
    env=None
    if args.approval_envelope:
        try:
            env=load_structured(Path(args.approval_envelope))
            ok,detail=validate_schema(env,approval_schema)
            add(results,"TASK-ENV-SCHEMA",ok,detail)
            expected=canonical_scope_hash(env)
            actual=str(env.get("scope_hash","")).removeprefix("sha256:")
            add(results,"TASK-ENV-HASH",expected==actual,f"expected={expected} actual={actual}")
            issued,expires=parse_dt(env["issued_at"]),parse_dt(env["expires_at"])
            duration=(expires-issued).total_seconds()
            add(results,"TASK-ENV-TIME",0<duration<=86400 and datetime.now(timezone.utc)<=expires,f"validity_seconds={duration}")
            gate=env.get("authority_gate"); actions=set(env.get("authorized_actions",[]))
            add(results,"TASK-ENV-GATE",gate_actions_valid(gate,actions),f"gate={gate}; actions={sorted(actions)}")
            if active_profile:
                repo=active_profile["repository"]
                expected_repo=f"{repo['owner']}/{repo['name']}"
                add(results,"TASK-ENV-PROFILE",env.get("project_profile")==active_profile.get("profile_id") and env.get("repository")==expected_repo,
                    f"envelope={env.get('project_profile')} {env.get('repository')}; profile={active_profile.get('profile_id')} {expected_repo}")
                if actions:
                    add(results,"TASK-PROFILE-WRITE-LOCK",repo.get("write_enabled") is True and repo.get("identity_status")=="verified",
                        f"identity={repo.get('identity_status')} write_enabled={repo.get('write_enabled')}")
        except Exception as exc:
            add(results,"TASK-ENV-SCHEMA",False,str(exc).splitlines()[0])
    else:
        add(results,"TASK-ENV-SCHEMA",None,"no task envelope supplied")

    # Optional change plan and visual artifacts.
    if args.change_plan:
        try:
            plan=load_structured(Path(args.change_plan))
            ok,detail=validate_schema(plan,plan_schema)
            add(results,"TASK-PLAN-SCHEMA",ok,detail)
            nodes=plan.get("nodes",[]); ids=[n["id"] for n in nodes]
            refs_ok=len(ids)==len(set(ids)) and all(e.get("from") in ids and e.get("to") in ids for e in plan.get("edges",[]))
            add(results,"TASK-PLAN-REFS",refs_ok,"unique IDs and valid edges")
            overview=[n for n in nodes if n.get("overview_row") is not None]
            orows=Counter(n["overview_row"] for n in overview)
            dpos=[(n["detail_row"],n["detail_col"]) for n in nodes]
            add(results,"TASK-PLAN-3X3",len(overview)<=9 and max(orows.values(),default=0)<=3 and set(orows).issubset({1,2,3}),
                f"overview={len(overview)} rows={dict(orows)}")
            add(results,"TASK-PLAN-6X6",len(nodes)<=36 and len(dpos)==len(set(dpos)) and all(1<=r<=6 and 1<=c<=6 for r,c in dpos),
                f"detail_nodes={len(nodes)} unique_positions={len(set(dpos))}")
        except Exception as exc:
            add(results,"TASK-PLAN-SCHEMA",False,str(exc).splitlines()[0])
    else:
        add(results,"TASK-PLAN-SCHEMA",None,"no change plan supplied")

    artifact_paths={"change_plan":Path(args.change_plan) if args.change_plan else None,
                    "mermaid":Path(args.mermaid) if args.mermaid else None,
                    "svg":Path(args.svg) if args.svg else None,
                    "png":Path(args.png) if args.png else None}
    if args.svg:
        ok,detail=validate_svg(Path(args.svg)); add(results,"TASK-SVG-SAFETY",ok,detail)
    else:
        add(results,"TASK-SVG-SAFETY",None,"no SVG supplied")
    if args.png:
        try:
            from PIL import Image
            with Image.open(args.png) as im:
                ok=im.width>=1200 and im.height>=675
                detail=f"{im.width}x{im.height}"
            add(results,"TASK-PNG-RESOLUTION",ok,detail)
        except Exception as exc:
            add(results,"TASK-PNG-RESOLUTION",False,str(exc))
    else:
        add(results,"TASK-PNG-RESOLUTION",None,"no PNG supplied")

    if env is not None:
        for key,path in artifact_paths.items():
            if path is None:
                add(results,"TASK-HASH-"+key,None,f"no {key} supplied")
            else:
                expected=str(env.get("artifact_hashes",{}).get(key,"")).removeprefix("sha256:")
                actual=sha256(path) if path.exists() else ""
                add(results,"TASK-HASH-"+key,expected==actual,f"expected={expected[:16]} actual={actual[:16]}")

    overall="PASS" if all(r["status"]!="FAIL" for r in results) else "FAIL"
    report={"overall":overall,"canonical_sha256":csha,"results":results}
    report_path=root/args.report
    report_path.write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    for r in results:
        print(f"{r['status']:4} {r['check']}: {r['detail']}")
    print("OVERALL:",overall)
    return 0 if overall=="PASS" else 1

if __name__=="__main__":
    raise SystemExit(main())
