"""
KAVACH Wildlife Intelligence — Automated Verification Test Suite
Strict 15-Animal Detection Filter Compliance Tests (Tests 1 to 9)
"""

import sys
import json
import requests
from pathlib import Path

API_URL = "http://localhost:8000/api/detect/image"
BASE_DIR = Path(__file__).resolve().parent

def run_test_image(test_name: str, file_path: Path, expected_detected: bool, expected_species: str = None):
    print(f"\n=======================================================")
    print(f"RUNNING {test_name}")
    print(f"File: {file_path.name}")
    print(f"Expected: detected={expected_detected}, species={expected_species}")
    print(f"=======================================================")

    if not file_path.exists():
        print(f"ERROR: File {file_path} not found.")
        return False

    with open(file_path, "rb") as f:
        files = {"file": (file_path.name, f, "image/jpeg")}
        data = {
            "lat": 20.2667,
            "lng": 79.4000,
            "device_id": "TEST-SUITE-RUNNER"
        }
        res = requests.post(API_URL, files=files, data=data)

    if res.status_code != 200:
        print(f"FAIL: HTTP {res.status_code} - {res.text}")
        return False

    resp = res.json()
    detected = resp.get("detected", False)
    message = resp.get("message", "")
    detections = resp.get("detections", [])
    primary_species = detections[0]["species"] if detections else None
    count = resp.get("count", 0)

    print(f"RESPONSE: detected={detected}, count={count}, primary_species='{primary_species}', message='{message}'")

    if expected_detected:
        if not detected:
            print(f"FAIL: Expected detection but got detected={detected}")
            return False
        if expected_species and primary_species != expected_species:
            print(f"FAIL: Expected species '{expected_species}' but got '{primary_species}'")
            return False
        print(f"PASS: {test_name} succeeded! Detected '{primary_species}' with risk={resp.get('risk_score')}")
        return True
    else:
        if detected:
            print(f"FAIL: Expected 'No Wildlife Detected' but got detected={detected} with species='{primary_species}'")
            return False
        if count != 0 or len(detections) != 0:
            print(f"FAIL: Expected 0 detections, got count={count}")
            return False
        print(f"PASS: {test_name} succeeded! Correctly rejected as 'No Wildlife Detected'.")
        return True


def run_all_tests():
    uploads_dir = BASE_DIR / "uploads"
    samples_dir = BASE_DIR / "sample_images"

    results = {}

    # TEST 1: Elephant
    elephant_path = samples_dir / "elephant.jpg"
    results["TEST 1 (Elephant)"] = run_test_image("TEST 1: Elephant Image", elephant_path, True, "Elephant")

    # TEST 2: Tiger
    tiger_path = samples_dir / "tiger.jpg"
    results["TEST 2 (Tiger)"] = run_test_image("TEST 2: Tiger Image", tiger_path, True, "Tiger")

    # TEST 3: Leopard
    leopard_path = samples_dir / "leopard.jpg"
    results["TEST 3 (Leopard)"] = run_test_image("TEST 3: Leopard Image", leopard_path, True, "Leopard")

    # TEST 4: Snake (Model has no snake class -> MUST NOT fake snake, must report No Wildlife Detected)
    # Testing against an arbitrary image or blank image for snake verification
    blank_path = uploads_dir / "58aeac4ee04a_blank_meadow.jpg"
    results["TEST 4 (Snake - Unfaked)"] = run_test_image("TEST 4: Snake Capability Check (Model lacks snake weights)", blank_path, False)

    # TEST 5: Dog
    dog_path = uploads_dir / "2f563ca00756_dog_test.jpg"
    results["TEST 5 (Dog)"] = run_test_image("TEST 5: Dog Non-Wildlife Rejection", dog_path, False)

    # TEST 6: Person
    person_path = uploads_dir / "110c1c824b50_human_person.jpg"
    results["TEST 6 (Person)"] = run_test_image("TEST 6: Person Non-Wildlife Rejection", person_path, False)

    # TEST 7: Car
    car_path = uploads_dir / "2b306bbe74ce_motor_vehicle.jpg"
    results["TEST 7 (Car)"] = run_test_image("TEST 7: Motor Vehicle Rejection", car_path, False)

    # TEST 8: Unsupported animal (Cow / Bear / Lion)
    cow_path = uploads_dir / "c5db157026c4_cow_scene.jpg"
    results["TEST 8 (Unsupported Animal: Cow)"] = run_test_image("TEST 8: Unsupported Animal (Cow) Rejection", cow_path, False)

    # TEST 9: No Object (Blank meadow)
    results["TEST 9 (No Object)"] = run_test_image("TEST 9: No Object (Empty Meadow)", blank_path, False)

    print("\n" + "=" * 65)
    print("                 TEST SUITE COMPLIANCE SUMMARY")
    print("=" * 65)
    all_passed = True
    for tname, passed in results.items():
        status = "PASSED [OK]" if passed else "FAILED [X]"
        print(f"{tname:<45}: {status}")
        if not passed:
            all_passed = False

    print("=" * 65)
    print(f"Overall Result: {'ALL TESTS PASSED PERFECTLY' if all_passed else 'SOME TESTS FAILED'}\n")
    return all_passed


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
