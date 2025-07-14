import React from 'react';

interface CertificateProps {
  name: string;
  score: number;
  totalQuestions: number;
  onBack: () => void;
}

// Global declaration for html2pdf
declare const html2pdf: any;

const Certificate: React.FC<CertificateProps> = ({ name, score, totalQuestions, onBack }) => {
  const completionDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleSaveAsPdf = () => {
    const element = document.getElementById('certificate-content');
    if (element) {
        const opt = {
            margin:       [0, 0, 0, 0], // Explicitly set all margins to 0
            filename:     `Certificate-${name.replace(/ /g, '_')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  {
                scale: 2, // A scale of 2 is high-resolution and more stable than 4.
                useCORS: true,
                scrollY: 0, // Ensure the capture starts from the top of the element.
                scrollX: 0,
            },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' },
            // Ensure the content is not split across pages.
            pagebreak:    { mode: 'avoid-all' }
        };
        // Use the chained syntax for clarity and consistency.
        html2pdf().set(opt).from(element).save();
    }
  };

  const standardMessage = "Congratulations on your excellent performance and dedication to mastering new knowledge.";

  return (
     <div className="w-full max-w-5xl mx-auto p-4">
        {/*
          Certificate container for both display and PDF generation.
          - `overflow-hidden` is crucial. It clips any content that might overflow
            the container's bounds, ensuring the element captured by html2pdf
            has the exact intended A4 aspect ratio. This prevents content from
            being cut off in the final PDF.
        */}
        <div id="certificate-content" className="bg-white text-black p-4 shadow-2xl aspect-[297/210] w-full overflow-hidden">
            <div className="border-4 border-amber-600 p-2 h-full w-full flex flex-col overflow-hidden">
                <div className="border-2 border-amber-700 p-8 h-full w-full flex flex-col items-center justify-center text-center relative overflow-hidden">
                    
                    <div className="absolute top-8 right-8">
                        <div className="w-28 h-28 border-4 border-amber-700 rounded-full flex flex-col items-center justify-center bg-amber-50">
                            <span className="text-4xl font-black text-amber-800 font-serif">CTG</span>
                            <span className="text-xs font-semibold text-amber-900">EST. 2014</span>
                        </div>
                    </div>

                    <p className="text-2xl font-serif text-gray-700 tracking-widest">Certificate of Achievement</p>
                    <p className="text-lg text-gray-600 mt-6">This certificate is proudly presented to</p>
                    
                    <h1 className="text-5xl font-serif text-amber-800 my-4 break-words" style={{fontFamily: "'Cormorant Garamond', serif"}}>{name}</h1>
                    
                    <p className="text-lg text-gray-600">for successfully completing the</p>
                    <p className="text-3xl font-semibold text-gray-800 font-serif my-2">Concrete Technology Proficiency Certificate</p>
                    
                    <div className="flex items-center justify-center my-4">
                        <p className="text-lg italic text-gray-700 max-w-2xl mx-auto">"{standardMessage}"</p>
                    </div>

                    <p className="text-lg text-gray-600">with a passing score of <span className="font-bold text-xl">{Math.round((score/totalQuestions)*100)}%</span>.</p>

                    <div className="mt-auto pt-6 w-full flex justify-between items-end text-sm text-gray-700">
                        <div className="text-center">
                            <p className="font-['Great_Vibes',_cursive] text-4xl -mb-4 text-gray-800">Manoj Balakrishnan</p>
                            <p className="w-48 h-px bg-gray-500 mx-auto"></p>
                            <p className="mt-2 font-semibold">Manoj Balakrishnan</p>
                            <p>Director, Concrete Technology Group</p>
                        </div>
                        <div className="text-center">
                             <p className="w-48 h-px bg-gray-500 mx-auto"></p>
                            <p className="mt-2 font-semibold">Date</p>
                            <p>{completionDate}</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        {/* Action Buttons (Not part of PDF) */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <button
                onClick={onBack}
                className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105"
            >
                Back to Results
            </button>
            <button
                onClick={handleSaveAsPdf}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform transform hover:scale-105"
            >
                Download as PDF
            </button>
        </div>
     </div>
  );
};

export default Certificate;
