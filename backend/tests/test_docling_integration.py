"""Opt-in: RUN_DOCLING=1 python -m pytest tests/test_docling_integration.py -v -s.

Downloads Docling model weights on first run. Never uses the xAI API.
"""
import os
import pytest


@pytest.mark.skipif(os.getenv("RUN_DOCLING") != "1", reason="Explicit opt-in required for model downloads")
def test_real_pdf_conversion(tmp_path):
    from reportlab.pdfgen import canvas
    from folio.conversion import convert_pdf
    source = tmp_path / "fixture.pdf"
    pdf = canvas.Canvas(str(source))
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(50, 780, "Reading with Folio")
    pdf.setFont("Helvetica", 12)
    pdf.drawString(50, 740, "A book keeps ideas alive. Reading makes new connections.")
    pdf.drawString(50, 710, "This PDF is generated locally for an integration test.")
    pdf.save()
    book = convert_pdf(source, tmp_path / "output", "integration", max_pages=5)
    assert book["version"] == 1
    assert any("Reading" in block["text"] for block in book["blocks"])
    assert all(block["sourcePage"] == 1 for block in book["blocks"])


@pytest.mark.skipif(os.getenv("RUN_DOCLING") != "1", reason="Explicit opt-in required for model downloads")
def test_real_pdf_keeps_picture_and_table(tmp_path):
    from PIL import Image, ImageDraw
    from reportlab.lib import colors
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas
    from reportlab.platypus import Table, TableStyle
    from folio.conversion import convert_pdf

    source = tmp_path / "illustrated.pdf"
    illustration = Image.new("RGB", (500, 280), "#f3efe3")
    draw = ImageDraw.Draw(illustration)
    draw.ellipse((160, 20, 340, 250), fill="#345445")
    draw.line((250, 250, 250, 40), fill="#c5d6ad", width=5)
    for y in range(75, 220, 30):
        draw.line((250, y + 20, 200, y), fill="#c5d6ad", width=3)
        draw.line((250, y + 20, 300, y), fill="#c5d6ad", width=3)
    pdf = canvas.Canvas(str(source))
    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(50, 780, "Plants and their pigments")
    pdf.setFont("Helvetica", 12)
    pdf.drawString(50, 745, "The leaf illustration below accompanies the pigment table.")
    pdf.drawImage(ImageReader(illustration), 50, 500, width=400, height=224)
    pdf.drawString(50, 480, "Figure 1. A leaf with a central vein.")
    table = Table([["Pigment", "Color", "Function"], ["Chlorophyll", "Green", "Photosynthesis"],
                   ["Carotene", "Orange", "Light absorption"]], colWidths=[150, 100, 200])
    table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 1, colors.black),
                               ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                               ("FONTSIZE", (0, 0), (-1, -1), 12),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 12)]))
    table.wrapOn(pdf, 450, 200)
    table.drawOn(pdf, 50, 320)
    pdf.save()
    output = tmp_path / "output"
    book = convert_pdf(source, output, "illustrated", max_pages=5)
    assert any(block["kind"] == "table" and "Chlorophyll" in block["text"] for block in book["blocks"])
    pictures = [block for block in book["blocks"] if block["kind"] == "image"]
    assert pictures
    assert all((output / "assets" / block["asset"]).is_file() for block in pictures)
