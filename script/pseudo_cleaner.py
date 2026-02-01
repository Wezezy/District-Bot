import json
from thefuzz import process

def clean_relations():
    try:
        with open('../data/members.json', 'r', encoding='utf-8') as f:
            members = json.load(f)
    except FileNotFoundError:
        print("Error : members.json not found.")
        return

    cleaned_members = []
    modifications = 0
    
    search_map = {}
    
    for m in members:
        username = m.get("username")
        displayName = m.get("displayName")
        
        if displayName: search_map[displayName] = displayName
        if username and displayName: search_map[username] = displayName
        
    search_choices = list(search_map.keys())
    
    for m in members:
        input_parent = m['parent']
        
        if not input_parent:
            cleaned_members.append(m)
            continue

        match, score = process.extractOne(input_parent, search_choices)

        if score >= 80:
            corrected_name = search_map[match]
            
            if corrected_name != input_parent:
                print(f"Correction : '{input_parent}' recognized as '{match}' -> Remplaced by '{corrected_name}' (Score: {score})")
                if 'inputedParentName' not in m:
                    m['inputedParentName'] = input_parent
                m['parent'] = corrected_name
                modifications += 1
        
        cleaned_members.append(m)

    if modifications > 0:
        with open('../data/members.json', 'w', encoding='utf-8') as f:
            json.dump(cleaned_members, f, indent=4, ensure_ascii=False)
        print(f"Finished ! {modifications} pseudos has been corrected.")
    else:
        print("pseudos in JSON file are already clean.")

if __name__ == "__main__":
    clean_relations()