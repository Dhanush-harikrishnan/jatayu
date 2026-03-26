import PDFDocument from 'pdfkit';

export interface ReportData {
  examId: string;
  sessionId: string;
  studentEmail: string;
  violations: {
    type: string;
    timestamp: string;
    evidence: string;
  }[];
}

export const generatePdfReport = async (data: ReportData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });

      // Header
      doc.fontSize(20).text('SecureGuard Pro - Assessment Report', { align: 'center' });
      doc.moveDown();

      // Details
      doc.fontSize(12).text(`Exam ID: ${data.examId}`);
      doc.text(`Session ID: ${data.sessionId}`);
      doc.text(`Student: ${data.studentEmail}`);
      doc.moveDown();

      // Summary
      doc.fontSize(16).text('Violations Summary', { underline: true });
      doc.moveDown();

      if (data.violations.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(12).text('No violations detected during the assessment.');
        doc.font('Helvetica'); // reset
      } else {
        data.violations.forEach((v, index) => {
          doc.fontSize(12).text(`${index + 1}. Type: ${v.type}`);
          doc.text(`   Time: ${new Date(v.timestamp).toLocaleString()}`);
          doc.text(`   Evidence: ${v.evidence}`);
          doc.moveDown();
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
