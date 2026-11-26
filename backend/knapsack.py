def knapsack(weights, values, capacity):
    n = len(weights)

    dp = [[0] * (capacity + 1) for _ in range(n + 1)]

    for i in range(1, n + 1):
        for w in range(capacity + 1):

            if weights[i - 1] <= w:
                dp[i][w] = max(
                    values[i - 1] + dp[i - 1][w - weights[i - 1]],
                    dp[i - 1][w]
                )
            else:
                dp[i][w] = dp[i - 1][w]

    return dp[n][capacity]


def solve_knapsack_detailed(items, capacity):
    """
    Runs the original knapsack algorithm and records detailed step-by-step
    Dynamic Programming states, decisions, and backtracking results for visualization.
    """
    weights = [int(item["weight"]) for item in items]
    values = [int(item["value"]) for item in items]
    n = len(weights)
    capacity = int(capacity)

    dp = [[0] * (capacity + 1) for _ in range(n + 1)]
    steps = []

    # Initial step: DP table initialized with zeros
    steps.append({
        "step_index": 0,
        "type": "init",
        "i": 0,
        "w": 0,
        "item": None,
        "current_capacity": 0,
        "can_fit": False,
        "include_value": None,
        "exclude_value": 0,
        "selected_value": 0,
        "decision": "init",
        "compare_cells": [],
        "active_lines": [2, 4],
        "explanation": {
            "summary": f"Initialized DP table of size ({n + 1}) × ({capacity + 1}) with 0s. Base case row i = 0 (0 items considered) has value 0 for all capacities.",
            "include": "Base case (no item to include).",
            "exclude": "Base case value is 0.",
            "formula": f"dp[0][0..{capacity}] = 0"
        },
        "dp_snapshot": [row[:] for row in dp]
    })

    step_counter = 1
    for i in range(1, n + 1):
        current_item = items[i - 1]
        wt = weights[i - 1]
        val = values[i - 1]

        for w in range(capacity + 1):
            exclude_val = dp[i - 1][w]

            if wt <= w:
                rem_w = w - wt
                prev_val_if_included = dp[i - 1][rem_w]
                include_val = val + prev_val_if_included
                chosen_val = max(include_val, exclude_val)
                dp[i][w] = chosen_val

                if include_val > exclude_val:
                    decision = "include"
                    decision_reason = (
                        f"Including '{current_item['name']}' gives {include_val} "
                        f"({val} + dp[{i - 1}][{rem_w}]={prev_val_if_included}), "
                        f"which is greater than excluding it ({exclude_val})."
                    )
                elif include_val == exclude_val:
                    decision = "tie_include"
                    decision_reason = (
                        f"Including '{current_item['name']}' ({include_val}) ties with "
                        f"excluding it ({exclude_val}). Maximum value remains {chosen_val}."
                    )
                else:
                    decision = "exclude_compared"
                    decision_reason = (
                        f"Excluding '{current_item['name']}' gives {exclude_val}, "
                        f"which is greater than including it ({include_val} = {val} + {prev_val_if_included})."
                    )

                steps.append({
                    "step_index": step_counter,
                    "type": "compute",
                    "i": i,
                    "w": w,
                    "item": {
                        "id": current_item.get("id", i),
                        "name": current_item["name"],
                        "weight": wt,
                        "value": val,
                        "icon": current_item.get("icon", "📦"),
                        "color": current_item.get("color", "#6366f1")
                    },
                    "current_capacity": w,
                    "can_fit": True,
                    "remaining_sub_capacity": rem_w,
                    "prev_sub_value": prev_val_if_included,
                    "include_value": include_val,
                    "exclude_value": exclude_val,
                    "selected_value": chosen_val,
                    "decision": decision,
                    "compare_cells": [
                        {"i": i - 1, "w": w, "role": "exclude", "value": exclude_val},
                        {"i": i - 1, "w": rem_w, "role": "include", "value": prev_val_if_included}
                    ],
                    "active_lines": [6, 7, 9, 10, 11, 12, 13],
                    "explanation": {
                        "summary": decision_reason,
                        "include": (
                            f"Item weight ({wt}) <= capacity ({w}). "
                            f"Value = {val} + dp[{i - 1}][{w} - {wt}] = {val} + dp[{i - 1}][{rem_w}] = {val} + {prev_val_if_included} = {include_val}"
                        ),
                        "exclude": f"Keep previous best without item: dp[{i - 1}][{w}] = {exclude_val}",
                        "formula": f"dp[{i}][{w}] = max({val} + dp[{i - 1}][{rem_w}], dp[{i - 1}][{w}]) = max({include_val}, {exclude_val}) = {chosen_val}"
                    },
                    "dp_snapshot": [row[:] for row in dp]
                })
            else:
                dp[i][w] = exclude_val
                steps.append({
                    "step_index": step_counter,
                    "type": "compute",
                    "i": i,
                    "w": w,
                    "item": {
                        "id": current_item.get("id", i),
                        "name": current_item["name"],
                        "weight": wt,
                        "value": val,
                        "icon": current_item.get("icon", "📦"),
                        "color": current_item.get("color", "#6366f1")
                    },
                    "current_capacity": w,
                    "can_fit": False,
                    "remaining_sub_capacity": None,
                    "prev_sub_value": None,
                    "include_value": None,
                    "exclude_value": exclude_val,
                    "selected_value": exclude_val,
                    "decision": "exclude_heavy",
                    "compare_cells": [
                        {"i": i - 1, "w": w, "role": "exclude", "value": exclude_val}
                    ],
                    "active_lines": [6, 7, 9, 14, 15],
                    "explanation": {
                        "summary": (
                            f"'{current_item['name']}' (weight {wt}) exceeds current capacity {w}. "
                            f"Cannot include; carry over dp[{i - 1}][{w}] = {exclude_val}."
                        ),
                        "include": f"Not possible — item weight ({wt}) > current capacity ({w}).",
                        "exclude": f"Carry over previous row value: dp[{i - 1}][{w}] = {exclude_val}",
                        "formula": f"dp[{i}][{w}] = dp[{i - 1}][{w}] = {exclude_val}"
                    },
                    "dp_snapshot": [row[:] for row in dp]
                })

            step_counter += 1

    max_value = dp[n][capacity]

    # Backtrack to find selected items and record backtracking path
    selected_items = []
    backtrack_path = []
    w_curr = capacity
    for i in range(n, 0, -1):
        if dp[i][w_curr] != dp[i - 1][w_curr]:
            item_obj = items[i - 1]
            selected_items.append(item_obj)
            backtrack_path.append({
                "i": i,
                "w": w_curr,
                "action": "selected",
                "from_i": i - 1,
                "from_w": w_curr - weights[i - 1],
                "item_id": item_obj.get("id", i)
            })
            w_curr -= weights[i - 1]
        else:
            backtrack_path.append({
                "i": i,
                "w": w_curr,
                "action": "skipped",
                "from_i": i - 1,
                "from_w": w_curr,
                "item_id": items[i - 1].get("id", i)
            })

    selected_items.reverse()
    total_weight = sum(int(item["weight"]) for item in selected_items)
    remaining_capacity = capacity - total_weight

    # Final step representing return dp[n][capacity]
    steps.append({
        "step_index": step_counter,
        "type": "complete",
        "i": n,
        "w": capacity,
        "item": items[n - 1] if n > 0 else None,
        "current_capacity": capacity,
        "can_fit": True,
        "include_value": max_value,
        "exclude_value": dp[n - 1][capacity] if n > 0 else 0,
        "selected_value": max_value,
        "decision": "complete",
        "compare_cells": [],
        "active_lines": [17],
        "explanation": {
            "summary": (
                f"Algorithm finished! Maximum achievable value at dp[{n}][{capacity}] is {max_value}. "
                f"Selected {len(selected_items)} item(s) using {total_weight}/{capacity} capacity."
            ),
            "include": f"Optimal subset value: {max_value}",
            "exclude": f"Unused capacity: {remaining_capacity}",
            "formula": f"return dp[{n}][{capacity}]  # {max_value}"
        },
        "dp_snapshot": [row[:] for row in dp]
    })

    return {
        "max_value": max_value,
        "dp_table": dp,
        "steps": steps,
        "selected_items": selected_items,
        "backtrack_path": backtrack_path,
        "total_weight": total_weight,
        "remaining_capacity": remaining_capacity,
        "capacity": capacity,
        "item_count": n
    }

