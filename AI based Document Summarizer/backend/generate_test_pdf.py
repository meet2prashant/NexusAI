from fpdf import FPDF
pdf = FPDF()
pdf.add_page()
pdf.set_font("helvetica", size=12)
pdf.cell(200, 10, text="This is a test document for the AI Document Summarizer.", new_x="LMARGIN", new_y="NEXT", align='C')
pdf.cell(200, 10, text="If you can read this, the document was uploaded and successfully parsed.", new_x="LMARGIN", new_y="NEXT", align='C')
pdf.cell(200, 10, text="The system now uses Gemini's native PDF functionality instead of PyPDF2.", new_x="LMARGIN", new_y="NEXT", align='C')
pdf.output("test_document.pdf")
