import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from knapsack import knapsack, solve_knapsack_detailed

app = Flask(__name__)
CORS(app)

KNAPSACK_FILE_PATH = os.path.join(os.path.dirname(__file__), "knapsack.py")


def get_knapsack_source():
    """Read the actual Python source code from knapsack.py."""
    with open(KNAPSACK_FILE_PATH, "r", encoding="utf-8") as f:
        full_source = f.read()

    lines = full_source.splitlines()
    # Extract the original knapsack function (lines 1-17) as well as the full file
    core_lines = lines[:17]
    return {
        "core_function": "\n".join(core_lines),
        "core_lines": [
            {"line_number": idx + 1, "code": line}
            for idx, line in enumerate(core_lines)
        ],
        "full_source": full_source,
        "full_lines": [
            {"line_number": idx + 1, "code": line}
            for idx, line in enumerate(lines)
        ]
    }

#بيتاكد ان الباك اند( السيرفر )  شغال
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "Knapsack Visualizer Python Backend"})

#ببياخد الكود بتاع الخوارزمية من ملف knapsack.py وبيعرضه على الويبسايت
@app.route("/api/source", methods=["GET"])
def source_code():
    """Return the actual Python source code from backend/knapsack.py."""
    return jsonify(get_knapsack_source())

#بيبعت البيانات وبيشغل الخوارزمية ويستقبل النتيجة 
@app.route("/api/solve", methods=["POST"])
def solve():
    """
    Solve the 0/1 Knapsack problem using the Python algorithm in knapsack.py.
    Expects JSON:
    {
      "capacity": 10,
      "items": [
        {"id": 1, "name": "Camera", "weight": 3, "value": 12, "icon": "📷", "color": "#38bdf8"},
        ...
      ]
    }
    """
    data = request.get_json(silent=True) or {}
    items = data.get("items", [])
    capacity = data.get("capacity", 10)

    try:
        capacity = int(capacity)
    except (ValueError, TypeError):
        return jsonify({"error": "Capacity must be an integer."}), 400

    if capacity < 1 or capacity > 50:
        return jsonify({"error": "Capacity must be between 1 and 50 for interactive visualization."}), 400

    sanitized_items = []
    for idx, item in enumerate(items):
        try:
            w = int(item.get("weight", 1))
            v = int(item.get("value", 1))
        except (ValueError, TypeError):
            return jsonify({"error": f"Invalid weight or value for item #{idx + 1}."}), 400

        if w < 1:
            return jsonify({"error": f"Weight must be at least 1 for item '{item.get('name', idx + 1)}'."}), 400
        if v < 0:
            return jsonify({"error": f"Value must be non-negative for item '{item.get('name', idx + 1)}'."}), 400

        sanitized_items.append({
            "id": item.get("id", idx + 1),
            "name": str(item.get("name", f"Item {idx + 1}")).strip() or f"Item {idx + 1}",
            "weight": w,
            "value": v,
            "icon": item.get("icon", "📦"),
            "color": item.get("color", "#6366f1")
        })

    result = solve_knapsack_detailed(sanitized_items, capacity)
    result["source"] = get_knapsack_source()
    return jsonify(result)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)

