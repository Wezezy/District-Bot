import json
from pyvis.network import Network

def hex_to_rgb(hex_col):
    h = hex_col.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def get_dynamic_gradient(level, max_level, start_hex="#ff4d4d", end_hex="#7289da"):
    if max_level == 0: 
        return start_hex
    
    ratio = min(max(level / max_level, 0), 1)
    
    rgb_start = hex_to_rgb(start_hex)
    rgb_end = hex_to_rgb(end_hex)
    
    r = int(rgb_start[0] + (rgb_end[0] - rgb_start[0]) * ratio)
    g = int(rgb_start[1] + (rgb_end[1] - rgb_start[1]) * ratio)
    b = int(rgb_start[2] + (rgb_end[2] - rgb_start[2]) * ratio)
    
    return f"#{r:02x}{g:02x}{b:02x}"


def generate_graph():

    net = Network(
        height="100vh", 
        width="100%",
        bgcolor="#161616",
        font_color="#e0e0e0", 
        directed=True
    )

    try:
        with open('../data/members.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Error : members.json not found.")
        return

    levels = {}
    invites = {r['displayName'] for r in data}
    parents = {r['parent'] for r in data}
    racines = parents - invites
    if not racines:
        racines = {data[0]['parent']}

    queue = []
    for r in racines:
        levels[r] = 0
        queue.append(r)

    while queue:
        actuel = queue.pop(0)
        for r in data:
            if r['parent'] == actuel and r['displayName'] not in levels:
                levels[r['displayName']] = levels[actuel] + 1
                queue.append(r['displayName'])
                
    max_depth = 0
    if levels:
        max_depth = max(levels.values())
    
    print(f"Graph depth : {max_depth} niveaux")

    score_influence = {}
    for r in data:
        p = r['parent']
        score_influence[p] = score_influence.get(p, 0) + 1

    added_nodes = set()
    for r in data:
        p, f = r['parent'], r['displayName']
        
        lvl_p = levels.get(p, 0)
        lvl_f = levels.get(f, 0)

        size_p = 10 + (score_influence.get(p, 0) * 8)
        size_f = 10 + (score_influence.get(f, 0) * 8)

        col_start = "#ff0055"
        col_end = "#7289da"
        
        if p not in added_nodes:
            color_p = get_dynamic_gradient(lvl_p, max_depth, col_start, col_end)
            
            net.add_node(p, label=p, size=size_p, color=color_p, title=f"Parent de {score_influence.get(p,0)} membres")
            added_nodes.add(p)

        if f not in added_nodes:
            color_f = get_dynamic_gradient(lvl_f, max_depth, col_start, col_end)
            
            net.add_node(f, label=f, size=size_f, color=color_f)
            added_nodes.add(f)

        net.add_edge(p, f, color="#30363d", width=1)


    net.set_options("""
    var options = {
      "physics": {
        "forceAtlas2Based": {
          "gravitationalConstant": -50,
          "centralGravity": 0.01,
          "springLength": 100,
          "springConstant": 0.08
        },
        "maxVelocity": 50,
        "solver": "forceAtlas2Based",
        "timestep": 0.35,
        "stabilization": { "iterations": 150 }
      }
    }
    """)

    net.save_graph("../index.html")
    print("Graph generated in index.html")

if __name__ == "__main__":
    generate_graph()