#!/usr/bin/env python3
"""
CSV → JSON 변환 스크립트.
server/lib/master/*.csv → client/public/master/*.json

사용법:
  python3 csv_to_json.py                  # 모든 CSV 변환
  python3 csv_to_json.py item             # item.csv만 변환
  python3 csv_to_json.py item pokemon     # 여러 파일 지정
"""

import csv
import json
import sys
from pathlib import Path

MASTER_DIR = Path(__file__).parent
CLIENT_MASTER_DIR = MASTER_DIR.parents[2] / "client" / "public" / "master"

# ── CSV 컬럼 → 클라이언트 JSON 필드 매핑 ──────────────────────────
# 각 CSV 파일별로 (csv_col → json_key, 변환함수) 를 정의한다.
# 변환함수가 None 이면 해당 컬럼은 클라이언트 JSON 에 포함하지 않는다 (서버 전용).

def _bool(v: str) -> bool:
    return v.strip().upper() == "TRUE"

def _int(v: str) -> int:
    return int(v.strip())

def _str(v: str) -> str:
    return v.strip()

# item.csv 매핑
ITEM_MAPPING: list[tuple[str, str | None, any]] = [
    ("id",          "id",          _str),
    ("comment",     "comment",     _str),
    ("category",    "category",    _str),
    ("buy",         "buyPrice",    _int),
    ("sell",        "sellPrice",   _int),
    ("purchasable", "purchasable", _bool),
    ("sellable",    "sellable",    _bool),
    ("tier",        "tier",        _str),
    # 서버 전용 필드 — 클라이언트 JSON 에서 제외
    ("spawn_max",   None,          None),
    ("spawn_rate",  None,          None),
    ("spawnable",   None,          None),
]

MAPPINGS: dict[str, list[tuple[str, str | None, any]]] = {
    "item": ITEM_MAPPING,
}


def convert(name: str) -> None:
    csv_path = MASTER_DIR / f"{name}.csv"
    json_path = CLIENT_MASTER_DIR / f"{name}.json"

    if not csv_path.exists():
        print(f"[SKIP] {csv_path} not found")
        return

    mapping = MAPPINGS.get(name)
    if not mapping:
        print(f"[SKIP] No mapping defined for '{name}'")
        return

    # csv_col → (json_key, converter)
    col_map: dict[str, tuple[str, any]] = {}
    for csv_col, json_key, converter in mapping:
        if json_key is not None:
            col_map[csv_col] = (json_key, converter)

    result: dict[str, dict] = {}

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry: dict = {}
            for csv_col, value in row.items():
                if csv_col in col_map:
                    json_key, converter = col_map[csv_col]
                    entry[json_key] = converter(value)

            item_id = entry.get("id", "")
            if item_id:
                result[item_id] = entry

    CLIENT_MASTER_DIR.mkdir(parents=True, exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"[OK] {csv_path.name} → {json_path}  ({len(result)} entries)")


def main() -> None:
    targets = sys.argv[1:] if len(sys.argv) > 1 else list(MAPPINGS.keys())
    for name in targets:
        convert(name)


if __name__ == "__main__":
    main()
