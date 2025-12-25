#!/usr/bin/env python3
import os
import subprocess
import sys


def run_forge_coverage() -> None:
    env = dict(os.environ)
    env.setdefault("FOUNDRY_DISABLE_SIGNATURES", "1")
    env.setdefault("FOUNDRY_DISABLE_ETHERSCAN", "1")
    env.setdefault("FOUNDRY_OFFLINE", "true")
    env.setdefault("NO_PROXY", "*")
    env.setdefault("HTTP_PROXY", "")
    env.setdefault("HTTPS_PROXY", "")
    result = subprocess.run(
        ["forge", "coverage", "--report", "lcov"],
        check=False,
        stdout=sys.stdout,
        stderr=sys.stderr,
        env=env,
    )
    if result.returncode != 0:
        sys.exit(result.returncode)


def parse_lcov(path: str) -> tuple[int, int, dict[str, dict[str, object]]]:
    total = 0
    covered = 0
    per_file: dict[str, dict[str, object]] = {}
    current = None
    with open(path, "r", encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if line.startswith("SF:"):
                current = line[3:]
                per_file[current] = {"covered": 0, "total": 0, "missed": []}
                continue
            if line.startswith("DA:") and current:
                payload = line[3:]
                parts = payload.split(",")
                if len(parts) < 2:
                    continue
                lineno = int(parts[0])
                hits = int(parts[1])
                per_file[current]["total"] += 1
                total += 1
                if hits > 0:
                    per_file[current]["covered"] += 1
                    covered += 1
                else:
                    per_file[current]["missed"].append(lineno)
            if line == "end_of_record":
                current = None
    return covered, total, per_file


def write_report(path: str, covered: int, total: int, per_file: dict[str, dict[str, object]]) -> None:
    pct = (covered / total) * 100 if total else 0.0
    grouped: dict[str, list[tuple[str, dict[str, object]]]] = {}
    for filename, data in per_file.items():
        contract_name = os.path.basename(filename)
        grouped.setdefault(contract_name, []).append((filename, data))
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("# Solidity Coverage Report\n\n")
        handle.write(f"Total: {covered}/{total} lines = {pct:.2f}%\n\n")
        handle.write("## Uncovered Lines (by contract)\n\n")
        for contract_name in sorted(grouped.keys()):
            entries = grouped[contract_name]
            missed_any = any(entry[1]["missed"] for entry in entries)
            if not missed_any:
                continue
            handle.write(f"### {contract_name}\n\n")
            for filename, data in entries:
                missed = data["missed"]
                if not missed:
                    continue
                file_total = int(data["total"])
                file_covered = int(data["covered"])
                file_pct = (file_covered / file_total) * 100 if file_total else 0.0
                missed_str = ", ".join(str(n) for n in missed)
                handle.write(f"- {filename}\n")
                handle.write(f"  - Coverage: {file_covered}/{file_total} = {file_pct:.2f}%\n")
                handle.write(f"  - Missed lines: {missed_str}\n")
            handle.write("\n")


def main() -> None:
    threshold = float(os.environ.get("COVERAGE_MIN", "90.0"))
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    run_forge_coverage()
    lcov_path = os.path.join(os.getcwd(), "lcov.info")
    if not os.path.exists(lcov_path):
        print("coverage check: lcov.info not found", file=sys.stderr)
        sys.exit(1)
    covered, total, per_file = parse_lcov(lcov_path)
    if total == 0:
        print("coverage check: no lines tracked", file=sys.stderr)
        sys.exit(1)
    pct = (covered / total) * 100
    report_path = os.path.join(root_dir, "docs", "reports", "coverage_report.md")
    write_report(report_path, covered, total, per_file)
    print(f"coverage check: {covered}/{total} lines = {pct:.2f}% (min {threshold:.2f}%)")
    print(f"coverage report: {report_path}")
    if pct + 1e-9 < threshold:
        sys.exit(1)


if __name__ == "__main__":
    main()
