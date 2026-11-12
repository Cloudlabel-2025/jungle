"""Read-only semantic QA for the fictional PDFs emitted by the integration test."""
import hashlib
import json
from pathlib import Path
from pypdf import PdfReader

catalogue = json.loads(Path("lib/pilot-part-b.json").read_text(encoding="utf-8"))
results = []
for kind, pages in [("passport", 2), ("certificate", 1)]:
    path = Path(f"output/pdf/part-b-fictional-{kind}.pdf")
    reader = PdfReader(path)
    text = " ".join(" ".join(page.extract_text().split()) for page in reader.pages)
    assert len(reader.pages) == pages
    assert "QA Gamer 0" in text
    if kind == "certificate":
        exact = " ".join(catalogue["finalFriday"]["certificate"]["exact_body"].split())
        assert exact in text, "Certificate wording changed"
        assert "Approved CORE" not in text and "ADMIN_CHAIR" not in text
        assert not reader.attachments, "Certificate must not attach the assessment dossier"
    else:
        assert "Approved CORE total: 100 / 100" in text
        assert "Technical Application: 40 / 40" in text
        assert "Additional bonuses (separate from core)" in text
        record = json.loads(reader.attachments["approved-source-record.json"][0])
        assert len(record["report"]["dossier"]["approved_core_assessment"]["criterion_scores"]) == 13
        assert record["evidence_index"]["E001"].startswith("https://example.invalid/")
        assert any(page.get("/Annots") for page in reader.pages), "Evidence URLs must be clickable"
    results.append({"file": str(path), "pages": pages, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                    "text_and_page_checks": "PASS", "fictional_unsigned_sample": True})
Path("artifacts/part-b-pdf-verification.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
print(json.dumps(results, indent=2))
