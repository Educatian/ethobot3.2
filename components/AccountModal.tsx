import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { User, X, Download, BookOpen, Mail, FileText, FileJson, Camera, RotateCcw, ChevronRight } from 'lucide-react';
import { fetchUserHistory } from '../services/loggingService';
import { toast } from 'react-hot-toast';
import { Message, ProblemStage } from '../types';

interface AccountModalProps {
    isOpen: boolean;
    user: { name: string; course: string; email?: string } | null;
    onClose: () => void;
    onLogout: () => void;
    onResumeSession: (messages: Message[], stage?: ProblemStage) => void | Promise<void>;
    onLogClick: (elementId: string, elementTag: string, textContent: string | null) => void;
}

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, user, onClose, onLogout, onResumeSession, onLogClick }) => {
    const { t } = useLanguage();
    const [isExporting, setIsExporting] = useState<string | null>(null);
    const [history, setHistory] = useState<{ messages: any[], activity: any[] } | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        const loadHistory = async () => {
            if (!isOpen || !user) return;
            setIsLoadingHistory(true);
            try {
                const data = await fetchUserHistory();
                setHistory(data);
            } catch (error) {
                console.error("Failed to load history", error);
            } finally {
                setIsLoadingHistory(false);
            }
        };
        loadHistory();
    }, [isOpen, user]);

    const downloadFile = (content: string, fileName: string, contentType: string) => {
        const a = document.createElement("a");
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const handleExportJson = () => {
        if (!history) return;
        onLogClick('export-json-button', 'button', 'Download JSON');
        const dataStr = JSON.stringify(history, null, 2);
        downloadFile(dataStr, `ethobot_history_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
        toast.success(t('historyDownloadSuccess'));
    };

    const handleExportTxt = () => {
        if (!history) return;
        onLogClick('export-txt-button', 'button', 'Download TXT');
        let txt = `ETHOBOT SESSION HISTORY\nUser: ${user?.name}\nCourse: ${user?.course}\nDate: ${new Date().toLocaleString()}\n\n`;
        txt += "--- CHAT LOG ---\n\n";
        history.messages.forEach((msg: any) => {
            txt += `[${new Date(msg.timestamp).toLocaleString()}] ${msg.user_name || 'User'}: ${msg.user_message}\n`;
            txt += `[${new Date(msg.timestamp).toLocaleString()}] ETHOBOT: ${msg.bot_response}\n\n`;
        });
        downloadFile(txt, `ethobot_history_${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
        toast.success(t('historyDownloadSuccess'));
    };

    const handleExportPdf = async () => {
        onLogClick('export-pdf-button', 'button', 'Download PDF');
        const chatElement = document.getElementById('chat-messages');
        if (!chatElement) {
            toast.error("Could not find chat window to capture.");
            return;
        }

        setIsExporting('pdf');
        const toastId = toast.loading("Capturing chat...");

        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf'),
            ]);

            // Expand the container temporarily to capture everything if needed, 
            // or just capture the current view.
            const canvas = await html2canvas(chatElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`ethobot_capture_${new Date().toISOString().split('T')[0]}.pdf`);

            toast.success(t('historyDownloadSuccess'), { id: toastId });
        } catch (error) {
            toast.error("PDF Export failed", { id: toastId });
        } finally {
            setIsExporting(null);
        }
    };

    const handleResume = (msg: any) => {
        onLogClick(`resume-session-${msg.id}`, 'button', 'Resume Session');
        if (window.confirm(t('resumeConfirm'))) {
            // Reconstruct messages for the UI
            // In this simple version, we'll just load the last few messages or this specific exchange.
            // For a true "resume", we'd need to fetch the whole chain.
            // Let's assume we load the selected message and its siblings if we had a sessionId.
            // Since we don't have sessionId yet, we'll just construct a single exchange for now 
            // OR better, load ALL history as a continuous chat.

            const reconstructedMessages: Message[] = history?.messages.flatMap((m: any) => [
                {
                    id: `user-${m.id}`,
                    sender: 'user' as const,
                    text: m.user_message,
                    timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                },
                {
                    id: `bot-${m.id}`,
                    sender: 'bot' as const,
                    text: m.bot_response,
                    timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
            ]) || [];

            onResumeSession(reconstructedMessages);
            onClose();
        }
    };

    if (!isOpen || !user) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-alabama-crimson to-crimson-dark p-6 text-white relative flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors z-[110]"
                        aria-label="Close"
                        title="Close account panel"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-center space-x-4">
                        <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                            <User size={32} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{t('myAccount')}</h2>
                            <p className="text-white/70 text-sm font-medium">Student Dashboard</p>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* User Info Section */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('studentInfo')}</h3>
                            <div className="space-y-3">
                                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <User size={16} className="text-alabama-crimson" />
                                    <span className="text-gray-700 font-medium">{user.name}</span>
                                </div>
                                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <Mail size={16} className="text-alabama-crimson" />
                                    <span className="text-gray-700 font-medium">{user.email || 'N/A'}</span>
                                </div>
                                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                    <BookOpen size={16} className="text-alabama-crimson" />
                                    <span className="text-gray-700 font-medium">{user.course}</span>
                                </div>
                            </div>

                            <div className="pt-6 space-y-3">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Download History</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    <button onClick={handleExportJson} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-gray-200" title="Export all activity data in JSON format">
                                        <FileJson size={18} className="text-blue-500" />
                                        <span className="text-sm font-semibold">{t('downloadData')} (JSON)</span>
                                    </button>
                                    <button onClick={handleExportTxt} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-gray-200" title="Download a readable text transcript of your chats">
                                        <FileText size={18} className="text-orange-500" />
                                        <span className="text-sm font-semibold">{t('downloadTxt')}</span>
                                    </button>
                                    <button onClick={handleExportPdf} disabled={isExporting === 'pdf'} className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-gray-200 disabled:opacity-50" title="Capture the current chat window as a PDF file">
                                        <Camera size={18} className="text-purple-500" />
                                        <span className="text-sm font-semibold">{t('downloadPdf')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Past Sessions List */}
                        <div className="space-y-4 flex flex-col h-full">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('pastSessions')}</h3>
                            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-2xl bg-gray-50 p-2 min-h-[300px]">
                                {isLoadingHistory ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="w-6 h-6 border-2 border-alabama-crimson border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : history?.messages.length ? (
                                    <div className="space-y-2">
                                        {[...history.messages].reverse().map((msg: any) => (
                                            <div key={msg.id} className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-alabama-crimson/30 transition-all group">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-[10px] font-bold text-gray-400">{new Date(msg.timestamp).toLocaleDateString()}</span>
                                                    <button
                                                        onClick={() => handleResume(msg)}
                                                        className="text-alabama-crimson opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center space-x-1"
                                                        title="Restore this past session to the main chat"
                                                    >
                                                        <RotateCcw size={12} />
                                                        <span className="text-[10px] font-bold uppercase">{t('resumeChat')}</span>
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-700 line-clamp-2 font-medium">
                                                    {msg.user_message}
                                                </p>
                                                <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                                                    <ChevronRight size={14} className="text-gray-300" />
                                                    <span className="text-[9px] text-gray-400">ID: {msg.id}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                                        <RotateCcw size={32} className="opacity-20" />
                                        <p className="text-sm font-medium">{t('noPastSessions')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
                    <button
                        onClick={() => {
                            onLogClick('logout-button-footer', 'button', 'Sign Out (Footer)');
                            onLogout();
                            onClose();
                        }}
                        className="px-6 py-2 text-gray-500 font-bold hover:text-red-600 transition-colors text-sm"
                        title="Securely log out of your account"
                    >
                        {t('signOut')}
                    </button>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">ETHOBOT PLATFORM v3.1</p>
                </div>
            </div>
        </div>
    );
};

export default AccountModal;
