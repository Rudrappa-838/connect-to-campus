
import React, { useState, useRef } from 'react';
import axios from '../../../api/axios';
import { toast } from 'react-hot-toast';
import { useReactToPrint } from 'react-to-print';
import { Loader2, Printer, Wand2 } from 'lucide-react';

const QuestionPaperGenerator = () => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        subject: '',
        class_level: '',
        prompt: ''
    });
    const [generatedPaper, setGeneratedPaper] = useState(null);
    const printRef = useRef();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!formData.prompt) {
            toast.error('Please enter a description for the paper');
            return;
        }

        setLoading(true);
        setGeneratedPaper(null);

        try {
            const response = await axios.post('/ai/generate-paper', formData);
            setGeneratedPaper(response.data);
            toast.success('Question Paper Generated!');
        } catch (error) {
            console.error('AI Error:', error);
            toast.error(error.response?.data?.error || 'Failed to generate paper');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: generatedPaper?.title || 'Question Paper',
    });

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-2">
                    <Wand2 className="w-8 h-8 text-purple-600" />
                    AI Question Paper Generator
                </h1>
                <p className="text-gray-600 mt-2">
                    Describe what you want (e.g., "10 MCQs on Photosynthesis for Class 8") and let AI create the exam.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Input Form */}
                <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-md border border-gray-100 h-fit">
                    <form onSubmit={handleGenerate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                            <input
                                type="text"
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                placeholder="e.g. Science"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class / Grade</label>
                            <input
                                type="text"
                                name="class_level"
                                value={formData.class_level}
                                onChange={handleChange}
                                placeholder="e.g. Class 10"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Instructions & Content <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                name="prompt"
                                value={formData.prompt}
                                onChange={handleChange}
                                rows="6"
                                placeholder="Describe the topics, number of questions, and difficulty.&#10;Example: 'Create a test on Newton's Laws. 5 MCQs and 2 Long Answer questions.'"
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-5 h-5" />
                                    Generate Paper
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Preview Area */}
                <div className="lg:col-span-2">
                    {generatedPaper ? (
                        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
                            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                                <h2 className="font-semibold text-gray-800">Preview</h2>
                                <button
                                    onClick={handlePrint}
                                    className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-700 transition-colors"
                                >
                                    <Printer className="w-4 h-4" />
                                    Print / Save PDF
                                </button>
                            </div>

                            {/* Printable Content */}
                            <div className="p-8 overflow-y-auto max-h-[800px]" ref={printRef}>
                                <div className="text-center mb-8 border-b pb-4">
                                    <h1 className="text-2xl font-bold uppercase tracking-wider">{generatedPaper.title || 'Examination'}</h1>
                                    <div className="flex justify-between mt-4 text-sm font-medium text-gray-600">
                                        <span>Subject: {formData.subject || 'General'}</span>
                                        <span>Class: {formData.class_level || 'General'}</span>
                                    </div>
                                    {generatedPaper.instructions && (
                                        <div className="mt-4 text-left text-sm text-gray-500 italic">
                                            <p className="font-semibold">Instructions:</p>
                                            <ul className="list-disc list-inside">
                                                {generatedPaper.instructions.map((inst, idx) => (
                                                    <li key={idx}>{inst}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-8">
                                    {generatedPaper.sections?.map((section, sIdx) => (
                                        <div key={sIdx}>
                                            <h3 className="text-lg font-bold text-gray-800 mb-4 uppercase border-b-2 border-gray-200 inline-block pb-1">
                                                {section.name}
                                            </h3>
                                            <div className="space-y-6">
                                                {section.questions?.map((q, qIdx) => (
                                                    <div key={q.id || qIdx} className="break-inside-avoid">
                                                        <div className="flex gap-2 font-medium text-gray-900">
                                                            <span>{qIdx + 1}.</span>
                                                            <div className="flex-1">
                                                                <p>{q.text}</p>
                                                                {/* Options for MCQs */}
                                                                {q.options && (
                                                                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-2 ml-2">
                                                                        {q.options.map((opt, oIdx) => (
                                                                            <div key={oIdx} className="text-sm text-gray-700">
                                                                                <span className="font-semibold mr-2">{String.fromCharCode(65 + oIdx)}.</span>
                                                                                {opt}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="text-sm text-gray-500 font-semibold ml-4">
                                                                [{q.marks || 1}]
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Answer Key (Printed on new page ideally, but here just appended) */}
                                <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-300 break-before-page">
                                    <h3 className="text-center font-bold text-gray-500 uppercase text-sm mb-4">-- Answer Key (For Teacher) --</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-600">
                                        {generatedPaper.sections?.map((section, sIdx) => (
                                            <div key={sIdx}>
                                                <strong className="block mb-2 text-gray-800">{section.name}</strong>
                                                {section.questions?.map((q, qIdx) => (
                                                    <div key={qIdx} className="mb-1">
                                                        <span className="font-semibold">{qIdx + 1}.</span> {q.answer || q.correct_option || 'N/A'}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-96 flex flex-col items-center justify-center text-gray-400">
                            <Wand2 className="w-12 h-12 mb-2 opacity-50" />
                            <p>Generated paper will appear here</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuestionPaperGenerator;
