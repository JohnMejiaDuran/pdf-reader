"""Map Docling's ordered document tree to an offline, executable-HTML-free contract."""
import re
from pathlib import Path
from typing import Any


def serialize_document(document: Any, destination: Path, book_id: str) -> dict:
    assets_dir = destination / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    blocks, assets, warnings = [], [], []
    for item, _ in document.iterate_items():
        label = str(item.label)
        if label in {"page_header", "page_footer"}:
            continue
        block_id = re.sub(r"[^a-zA-Z0-9_-]", "-", item.self_ref.removeprefix("#/"))
        provenance = getattr(item, "prov", [])
        block = {"id": block_id, "sourcePage": provenance[0].page_no if provenance else 1}
        if label == "picture":
            image = item.get_image(document)
            if image is None:
                warnings.append(f"No se pudo extraer una ilustración de la página {block['sourcePage']}.")
                continue
            filename = f"{block_id}.png"
            image.save(assets_dir / filename, "PNG")
            block.update(kind="image", asset=filename, caption=item.caption_text(document), text="")
            assets.append(filename)
        elif label == "table":
            cells = [{
                "row": c.start_row_offset_idx, "col": c.start_col_offset_idx,
                "rowSpan": max(1, c.end_row_offset_idx - c.start_row_offset_idx),
                "colSpan": max(1, c.end_col_offset_idx - c.start_col_offset_idx),
                "text": c.text, "header": bool(c.column_header),
            } for c in item.data.table_cells]
            block.update(kind="table", cells=cells, rows=item.data.num_rows,
                         text="\n".join(c["text"] for c in cells))
        elif hasattr(item, "text") and item.text.strip():
            kind = "heading" if label in {"title", "section_header"} else "paragraph"
            block.update(kind=kind, text=item.text)
        else:
            continue
        blocks.append(block)
    if not blocks:
        raise ValueError("El PDF no produjo contenido legible.")
    return {"version": 1, "id": book_id, "title": document.name or "Sin título",
            "blocks": blocks, "assets": assets, "warnings": warnings}


def convert_pdf(source: Path, destination: Path, book_id: str, max_pages: int = 500) -> dict:
    # Models are downloaded on first conversion, not during health checks.
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import DocumentConverter, PdfFormatOption

    options = PdfPipelineOptions(generate_picture_images=True, images_scale=1.5,
                                 do_ocr=True, do_table_structure=True)
    converter = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=options)})
    result = converter.convert(source, max_num_pages=max_pages, max_file_size=50 * 1024 * 1024)
    if str(result.status).lower().split(".")[-1] not in {"success", "partial_success"}:
        raise ValueError("No se pudo convertir el PDF. Puede estar protegido o dañado.")
    book = serialize_document(result.document, destination, book_id)
    if str(result.status).lower().endswith("partial_success"):
        book["warnings"].append("Conversión parcial: revisá el contenido frente al PDF original.")
    return book
