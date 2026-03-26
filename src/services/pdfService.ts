import PDFDocument from 'pdfkit';

export interface ReportData {
  examId: string;
  sessionId: string;
  studentEmail: string;
  violations: {
    type: string;
    timestamp: string;
    evidence: string;
    metadata?: any;
    evidenceImage?: Buffer;
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
      doc.text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      // Summary
      doc.fontSize(16).text('Violations Summary', { underline: true });
      doc.moveDown();

      const typeCounts = data.violations.reduce<Record<string, number>>((acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      }, {});
      const totalViolations = data.violations.length;
      const highRisk = data.violations.filter(v => ['phone_detected', 'multiple_faces', 'copy_paste_attempt', 'voice_detected'].includes(v.type)).length;

      doc.fontSize(11).text(`Total Violations: ${totalViolations}`);
      doc.text(`High Risk Violations: ${highRisk}`);
      if (Object.keys(typeCounts).length > 0) {
        doc.text(`By Type: ${Object.entries(typeCounts).map(([k, n]) => `${k} (${n})`).join(', ')}`);
      }
      doc.moveDown();

      if (data.violations.length === 0) {
        doc.font('Helvetica-Oblique')
           .fontSize(12)
           .text('No violations detected during the assessment.');
      } else {
        data.violations.forEach((v, index) => {
          if (doc.y > 680) {
            doc.addPage();
          }

          doc.font('Helvetica-Bold').fontSize(12).text(`${index + 1}. Type: ${v.type}`);
          doc.font('Helvetica').fontSize(11).text(`   Time: ${new Date(v.timestamp).toLocaleString()}`);
          doc.text(`   Evidence Key: ${v.evidence || 'N/A'}`);

          const confidence = v.metadata?.confidence;
          const firstFace = v.metadata?.faceDetails?.[0];
          const yaw = firstFace?.eyeGaze?.yaw;
          const pitch = firstFace?.eyeGaze?.pitch;

          if (typeof confidence === 'number') {
            doc.text(`   AI Confidence: ${(confidence * 100).toFixed(1)}%`);
          }
          if (typeof yaw === 'number' || typeof pitch === 'number') {
            doc.text(`   Face Pose (yaw/pitch): ${typeof yaw === 'number' ? yaw.toFixed(1) : 'N/A'} / ${typeof pitch === 'number' ? pitch.toFixed(1) : 'N/A'}`);
          }

          if (v.evidenceImage && v.evidenceImage.length > 0) {
            try {
              if (doc.y > 560) {
                doc.addPage();
              }
              doc.text('   Evidence Snapshot:');
              const imageWidth = 220;
              const imageHeight = 140;
              doc.image(v.evidenceImage, doc.x + 16, doc.y + 6, {
                fit: [imageWidth, imageHeight],
                align: 'center',
                valign: 'center',
              });
              doc.y += imageHeight + 14;
            } catch {
              doc.text('   Evidence Snapshot: Unable to render image');
            }
          }

          doc.moveDown();
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
