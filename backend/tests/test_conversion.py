from types import SimpleNamespace as NS
from folio.conversion import serialize_document


class Document:
    name = "Botánica"

    def iterate_items(self):
        for item in [
            NS(label="section_header", self_ref="#/texts/0", text="Las hojas", prov=[NS(page_no=1)]),
            NS(label="text", self_ref="#/texts/1", text="La fotosíntesis transforma energía.", prov=[NS(page_no=1)]),
            NS(label="table", self_ref="#/tables/0", data=NS(num_rows=2, num_cols=2, table_cells=[
                NS(start_row_offset_idx=0, end_row_offset_idx=1, start_col_offset_idx=0, end_col_offset_idx=2, text="Pigmentos", column_header=True),
                NS(start_row_offset_idx=1, end_row_offset_idx=2, start_col_offset_idx=0, end_col_offset_idx=1, text="Clorofila", column_header=False),
                NS(start_row_offset_idx=1, end_row_offset_idx=2, start_col_offset_idx=1, end_col_offset_idx=2, text="Verde", column_header=False),
            ]), prov=[NS(page_no=2)]),
        ]:
            yield item, 0


def test_preserves_order_stable_references_and_table_spans(tmp_path):
    book = serialize_document(Document(), tmp_path, "abc")
    assert [b["kind"] for b in book["blocks"]] == ["heading", "paragraph", "table"]
    assert book["blocks"][0]["id"] == "texts-0"
    assert book["blocks"][2]["sourcePage"] == 2
    assert book["blocks"][2]["cells"][0]["colSpan"] == 2
    assert book["blocks"][2]["text"] == "Pigmentos\nClorofila\nVerde"


def test_empty_document_is_not_a_success(tmp_path):
    import pytest
    with pytest.raises(ValueError, match="contenido"):
        serialize_document(NS(name="Vacío", iterate_items=lambda: iter([])), tmp_path, "abc")


def test_picture_is_extracted_in_place_with_caption(tmp_path):
    from PIL import Image
    picture = NS(label="picture", self_ref="#/pictures/0", prov=[NS(page_no=3)],
                 get_image=lambda _: Image.new("RGB", (8, 8), "green"), caption_text=lambda _: "Una hoja")
    document = NS(name="Plantas", iterate_items=lambda: iter([(picture, 0)]))
    book = serialize_document(document, tmp_path, "abc")
    assert book["blocks"][0]["asset"] == "pictures-0.png"
    assert book["blocks"][0]["caption"] == "Una hoja"
    assert (tmp_path / "assets" / "pictures-0.png").is_file()
