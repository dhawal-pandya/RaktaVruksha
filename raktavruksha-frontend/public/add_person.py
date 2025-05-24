import json


def add_person_to_family_tree(filename="family_tree.json"):
    """
    Adds a new person to the family tree JSON file.
    It attempts to update relationships for existing people but doesn't
    warn if linked IDs are not found, allowing for later additions.
    """
    try:
        with open(filename, "r") as f:
            data = json.load(f)
            people = data.get("people", [])
    except FileNotFoundError:
        print(f"File '{filename}' not found. A new file will be created.")
        people = []
        data = {"people": people}

    new_person = {}
    new_person["id"] = input("Enter new person's ID (e.g., 'JohnDoe'): ")
    new_person["first_name"] = input("Enter new person's first name: ")
    new_person["last_name"] = input("Enter new person's last name: ")

    alive_input = input("Is the person alive? (yes/no): ").lower()
    new_person["alive"] = True if alive_input == "yes" else False

    new_person["gender"] = input("Enter new person's gender (male/female): ")

    parent_ids_input = input(
        "Enter parent IDs, separated by commas (leave blank if none): "
    )
    new_person["parents"] = [
        p.strip() for p in parent_ids_input.split(",") if p.strip()
    ]

    for parent_id in new_person["parents"]:
        for person in people:
            if person["id"] == parent_id:
                if new_person["id"] not in person["children"]:
                    person["children"].append(new_person["id"])
                break

    spouse_ids_input = input(
        "Enter spouse IDs, separated by commas (leave blank if none): "
    )
    new_person["spouses"] = [
        s.strip() for s in spouse_ids_input.split(",") if s.strip()
    ]

    for spouse_id in new_person["spouses"]:
        for person in people:
            if person["id"] == spouse_id:
                if new_person["id"] not in person["spouses"]:
                    person["spouses"].append(new_person["id"])
                break

    child_ids_input = input(
        "Enter child IDs, separated by commas (leave blank if none): "
    )
    new_person["children"] = [
        c.strip() for c in child_ids_input.split(",") if c.strip()
    ]

    for child_id in new_person["children"]:
        for person in people:
            if person["id"] == child_id:
                if new_person["id"] not in person["parents"]:
                    person["parents"].append(new_person["id"])
                break

    new_person["birth_family_id"] = input(
        "Enter birth family ID (e.g., 'familyPandya'): "
    )
    new_person["current_family_id"] = input(
        "Enter current family ID (e.g., 'familyPandya'): "
    )

    people.append(new_person)
    print(
        f"\nAdded '{new_person['first_name']} {new_person['last_name']}' to the family tree."
    )

    try:
        with open(filename, "w") as f:
            json.dump(data, f, indent=2)
        print(f"Family tree data saved to '{filename}'.")
    except IOError as e:
        print(f"Error saving file: {e}")


if __name__ == "__main__":
    add_person_to_family_tree()
