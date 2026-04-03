import PDFDocument from 'pdfkit';

export interface ReportData {
  examId: string;
  sessionId: string;
  studentEmail: string;
  studentName?: string;
  score?: number;
  totalPoints?: number;
  trustScore?: number;
  aiSummary?: string;
  violations: {
    type: string;
    timestamp: string;
    evidence: string;
    metadata?: any;
    evidenceImage?: Buffer;
  }[];
}

const VIOLATION_LABELS: Record<string, string> = {
  phone_detected: 'Mobile Phone Detected',
  multiple_faces: 'Multiple Faces Detected',
  face_not_detected: 'Face Not Visible',
  looking_away: 'Candidate Looking Away',
  copy_paste_attempt: 'Copy / Paste Attempt',
  voice_detected: 'Unauthorized Voice Activity',
  gyro_movement: 'Device Movement Detected',
  PHONE_DETECTED: 'Mobile Phone Detected',
  MULTIPLE_PERSONS_DETECTED: 'Multiple Persons Detected',
  FACE_NOT_DETECTED: 'Face Not Detected',
  LOOKING_AWAY: 'Looking Away',
  PHONE_MOVEMENT_DETECTED: 'Phone Movement Detected',
  BOOK_DETECTED: 'Book/Document Detected',
  MULTIPLE_LAPTOPS_DETECTED: 'Multiple Laptops/Computers Detected',
  MULTIPLE_PERSONS_DETECTED_MOBILE: 'Multiple Persons Detected (Mobile)',
  OFF_SCREEN_TYPING: 'Off-Screen Typing Suspected',
  SUSPECTED_TRANSCRIPTION: 'Suspected Voice Transcription',
  TAB_SWITCH: 'Tab Switch / Interruption',
  COPY_PASTE: 'Clipboard Action Detected',
};

const SEVERITY_COLORS: Record<string, [number, number, number]> = {
  phone_detected: [220, 53, 69],
  multiple_faces: [220, 53, 69],
  copy_paste_attempt: [220, 53, 69],
  voice_detected: [220, 53, 69],
  face_not_detected: [255, 153, 0],
  looking_away: [255, 153, 0],
  gyro_movement: [255, 153, 0],
  PHONE_DETECTED: [220, 53, 69],
  MULTIPLE_PERSONS_DETECTED: [220, 53, 69],
  FACE_NOT_DETECTED: [255, 153, 0],
  LOOKING_AWAY: [255, 153, 0],
  PHONE_MOVEMENT_DETECTED: [255, 153, 0],
  BOOK_DETECTED: [220, 53, 69],
  MULTIPLE_LAPTOPS_DETECTED: [220, 53, 69],
  MULTIPLE_PERSONS_DETECTED_MOBILE: [220, 53, 69],
  OFF_SCREEN_TYPING: [255, 153, 0],
  SUSPECTED_TRANSCRIPTION: [220, 53, 69],
  TAB_SWITCH: [255, 153, 0],
  COPY_PASTE: [220, 53, 69],
};

function drawHLine(doc: PDFKit.PDFDocument, color: [number, number, number] = [60, 60, 80]) {
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(color).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
}

function severityOf(type: string): string {
  const high = ['phone_detected', 'multiple_faces', 'copy_paste_attempt', 'voice_detected', 'PHONE_DETECTED', 'MULTIPLE_PERSONS_DETECTED', 'BOOK_DETECTED', 'MULTIPLE_LAPTOPS_DETECTED', 'MULTIPLE_PERSONS_DETECTED_MOBILE', 'SUSPECTED_TRANSCRIPTION', 'COPY_PASTE'];
  return high.includes(type) ? 'HIGH' : 'MEDIUM';
}

export const generatePdfReport = async (data: ReportData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => { resolve(Buffer.concat(buffers)); });

      // ──────────────── COVER HEADER ────────────────
      doc.rect(0, 0, doc.page.width, 110).fill([15, 23, 42]);
      doc.fill([0, 240, 255]).fontSize(22).font('Helvetica-Bold')
         .text('SecureGuard Pro', 50, 28);
      doc.fill([160, 180, 210]).fontSize(10).font('Helvetica')
         .text('AI-Powered Proctoring Assessment Report', 50, 56);

      const now = new Date();
      doc.fill([160, 180, 210]).fontSize(9)
         .text(`Generated: ${now.toUTCString()}`, 50, 74);

      doc.fill([255, 255, 255]).fontSize(9)
         .text(`CONFIDENTIAL`, doc.page.width - 135, 74, { align: 'right' });

      doc.y = 130;

      // ──────────────── SESSION DETAILS ────────────────
      doc.fill([0, 240, 255]).fontSize(13).font('Helvetica-Bold').text('Session Details');
      doc.moveDown(0.3);
      drawHLine(doc, [0, 100, 120]);

      const details: [string, string][] = [
        ['Exam ID', data.examId],
        ['Session ID', data.sessionId],
        ['Student', data.studentName || data.studentEmail],
        ['Email', data.studentEmail],
        ['Report Date', now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
        ['Report Time', now.toLocaleTimeString('en-IN')],
      ];
      if (data.score !== undefined) {
        details.push(['Score', `${data.score} / ${data.totalPoints || '?'}`]);
      }
      if (data.trustScore !== undefined) {
        details.push(['Trust Score', `${Math.round(data.trustScore)}/100`]);
      }
      
      details.forEach(([label, value]) => {
        doc.font('Helvetica-Bold').fill([140, 160, 200]).fontSize(9).text(label + ':', 50, doc.y, { continued: true, width: 120 });
        doc.font('Helvetica').fill([220, 230, 255]).fontSize(9).text(' ' + value);
      });

      doc.moveDown(1.5);

      // ──────────────── AI SUMMARY (Sprint 2 Feature) ────────────────
      if (data.aiSummary) {
        doc.fill([0, 240, 255]).fontSize(13).font('Helvetica-Bold').text('AI Proctoring Summary');
        doc.moveDown(0.3);
        drawHLine(doc, [0, 100, 120]);
        doc.moveDown(0.5);

        // Add a soft background for the AI box
        doc.rect(50, doc.y, doc.page.width - 100, 75).fill([20, 30, 50]);
        
        doc.fill([200, 220, 255]).fontSize(10).font('Helvetica-Oblique').text(data.aiSummary, 60, doc.y - 65, { width: doc.page.width - 120, lineGap: 3 });
        
        doc.y += 85; 
      }

      // ──────────────── SUMMARY PANEL ────────────────
      doc.fill([0, 240, 255]).fontSize(13).font('Helvetica-Bold').text('Violation Breakdown');
      doc.moveDown(0.3);
      drawHLine(doc, [0, 100, 120]);

      const totalViolations = data.violations.length;
      const highRisk = data.violations.filter(v =>
        ['phone_detected', 'multiple_faces', 'copy_paste_attempt', 'voice_detected',
         'PHONE_DETECTED', 'MULTIPLE_PERSONS_DETECTED'].includes(v.type)
      ).length;
      const mediumRisk = totalViolations - highRisk;

      const typeCounts: Record<string, number> = {};
      data.violations.forEach(v => {
        const label = VIOLATION_LABELS[v.type] || v.type;
        typeCounts[label] = (typeCounts[label] || 0) + 1;
      });

      const verdict = totalViolations === 0 ? 'CLEAR' : highRisk > 2 ? 'FLAGGED' : 'REVIEW';
      const verdictColor: [number, number, number] = totalViolations === 0
        ? [46, 204, 113] : highRisk > 2 ? [220, 53, 69] : [255, 153, 0];

      // Draw verdict badge
      const vx = doc.page.width - 160;
      const vy = doc.y - 5;
      doc.roundedRect(vx, vy, 110, 30, 6).fill(verdictColor);
      doc.fill([255, 255, 255]).fontSize(12).font('Helvetica-Bold')
         .text(verdict, vx, vy + 8, { width: 110, align: 'center' });

      doc.y = vy + 40;

      doc.fill([220, 230, 255]).fontSize(10).font('Helvetica');
      doc.text(`Total Violations: ${totalViolations}`);
      doc.fillColor([220, 53, 69]).text(`High Risk: ${highRisk}`);
      doc.fillColor([255, 153, 0]).text(`Medium Risk: ${mediumRisk}`);
      doc.fill([220, 230, 255]);

      if (Object.keys(typeCounts).length > 0) {
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').text('Breakdown by Type:');
        Object.entries(typeCounts).forEach(([type, count]) => {
          doc.font('Helvetica').text(`  • ${type}: ${count} occurrence${count > 1 ? 's' : ''}`);
        });
      }

      doc.moveDown();

      // ──────────────── VIOLATION DETAIL ────────────────
      if (data.violations.length === 0) {
        doc.moveDown();
        doc.roundedRect(50, doc.y, doc.page.width - 100, 50, 8).fill([20, 45, 30]);
        doc.fill([46, 204, 113]).fontSize(13).font('Helvetica-Bold')
           .text('✔  No violations detected during this examination session.', 65, doc.y - 37, { width: doc.page.width - 130 });
      } else {
        doc.fill([0, 240, 255]).fontSize(13).font('Helvetica-Bold').text('Violation Log');
        doc.moveDown(0.3);
        drawHLine(doc, [0, 100, 120]);

        data.violations.forEach((v, index) => {
          if (doc.y > 680) doc.addPage();

          const sev = severityOf(v.type);
          const sevColor: [number, number, number] = SEVERITY_COLORS[v.type] || [255, 153, 0];
          const labelText = VIOLATION_LABELS[v.type] || v.type;

          const boxY = doc.y;
          doc.roundedRect(50, boxY, doc.page.width - 100, 12).fill([25, 30, 55]);
          doc.fill([200, 210, 240]).fontSize(9).font('Helvetica-Bold')
             .text(`#${index + 1}  ${labelText}`, 60, boxY + 2, { continued: true });

          // Severity badge
          doc.fill(sevColor).fontSize(8)
             .text(`  [${sev}]`, { continued: false });

          doc.y = boxY + 18;

          const ts = new Date(v.timestamp).toLocaleString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          });
          doc.fill([160, 180, 210]).fontSize(9).font('Helvetica')
             .text(`  Timestamp: ${ts}`, 60);

          const confidence = v.metadata?.confidence;
          if (typeof confidence === 'number') {
            const confPct = (confidence * 100).toFixed(1);
            doc.text(`  AI Confidence: ${confPct}%`, 60);
          }

          const firstFace = v.metadata?.faceDetails?.[0];
          const yaw = firstFace?.eyeGaze?.yaw;
          const pitch = firstFace?.eyeGaze?.pitch;
          if (typeof yaw === 'number' || typeof pitch === 'number') {
            doc.text(
              `  Face Pose — Yaw: ${typeof yaw === 'number' ? yaw.toFixed(1) + '°' : 'N/A'}  Pitch: ${typeof pitch === 'number' ? pitch.toFixed(1) + '°' : 'N/A'}`,
              60
            );
          }

          if (v.metadata?.label) {
            doc.text(`  Detected Object: ${v.metadata.label}`, 60);
          }

          doc.fill([80, 100, 140]).fontSize(8)
             .text(`  Evidence Key: ${v.evidence || 'N/A'}`, 60);

          if (v.evidenceImage && v.evidenceImage.length > 0) {
            try {
              if (doc.y > 560) doc.addPage();
              doc.fill([160, 180, 210]).fontSize(9).text('  Evidence Snapshot:', 60);
              const imgW = 240, imgH = 150;
              doc.image(v.evidenceImage, 65, doc.y + 4, { fit: [imgW, imgH] });
              doc.y += imgH + 14;
            } catch {
              doc.fill([180, 80, 80]).text('  [Evidence image could not be rendered]', 60);
            }
          }

          doc.moveDown(0.5);
          drawHLine(doc, [40, 50, 80]);
        });
      }

      // ──────────────── FOOTER ────────────────
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.fill([60, 80, 120]).fontSize(8)
           .text(
             `SecureGuard Pro  •  Page ${i - range.start + 1} of ${range.count}  •  ${data.studentEmail}`,
             50, doc.page.height - 30,
             { align: 'center', width: doc.page.width - 100 }
           );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
