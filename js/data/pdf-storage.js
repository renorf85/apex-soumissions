/* =====================================================
   PDF STORAGE - Upload/download PDFs (Supabase Storage)
   ===================================================== */

window.PdfStorage = {
    async uploadPdf(blob, path) {
        const { data, error } = await supabaseClient.storage
            .from('soumissions-pdfs')
            .upload(path, blob, {
                contentType: 'application/pdf',
                upsert: false
            });

        if (error) throw error;
        return data.path;
    },

    async getDownloadUrl(path) {
        const { data, error } = await supabaseClient.storage
            .from('soumissions-pdfs')
            .createSignedUrl(path, 3600);

        if (error) throw error;
        return data.signedUrl;
    },

    async downloadPdf(path, filename) {
        const { data, error } = await supabaseClient.storage
            .from('soumissions-pdfs')
            .download(path);

        if (error) throw error;

        await downloadBlob(data, filename || 'document.pdf');
    },

    async uploadBothPdfs(pdfClientBlob, pdfDetailBlob, numero) {
        const timestamp = Date.now();
        const folder = `${numero}_${timestamp}`;

        const clientPath = `${folder}/Soumission_${numero}.pdf`;
        const detailPath = `${folder}/Soumission_${numero}_detail.pdf`;

        await Promise.all([
            this.uploadPdf(pdfClientBlob, clientPath),
            this.uploadPdf(pdfDetailBlob, detailPath)
        ]);

        return { clientPath, detailPath };
    }
};
