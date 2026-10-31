import React, { useState, useRef } from 'react';
import { Mic, Square, Volume2, Trash2 } from 'lucide-react';

interface AudioRecorderControlProps {
  questionId: string;
  currentAudio?: string;
  onUpdateAudio: (audioDataUrl: string) => void;
}

export const AudioRecorderControl: React.FC<AudioRecorderControlProps> = ({
  questionId,
  currentAudio,
  onUpdateAudio,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            onUpdateAudio(reader.result as string);
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert('تعذر الوصول إلى المايكروفون. يرجى التأكد من السماح بصلاحيات المايكروفون في المتصفح.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full">
      {currentAudio ? (
        <div className="mt-2 p-3 bg-indigo-50/80 rounded-2xl border border-indigo-200 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs sm:text-sm">
              <Volume2 className="text-indigo-600" size={18} />
              <span>المقطع الصوتي المرفق للسؤال (سؤال استماعي):</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateAudio('')}
              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg font-bold transition-all border border-red-200 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>حذف المقطع الصوتي</span>
            </button>
          </div>
          <audio controls src={currentAudio} className="w-full h-10 rounded-lg shadow-xs" />
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          {/* File Upload Button */}
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 15 * 1024 * 1024) {
                  alert('حجم الملف الصوتي كبير جداً. يرجى اختيار ملف بحجم أقل من 15 ميجابايت.');
                  return;
                }
                const reader = new FileReader();
                reader.onloadend = () => {
                  onUpdateAudio(reader.result as string);
                };
                reader.readAsDataURL(file);
              }
            }}
            className="hidden"
            id={`audio-upload-${questionId}`}
          />
          <label
            htmlFor={`audio-upload-${questionId}`}
            className="cursor-pointer text-violet-700 hover:text-violet-900 inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl border border-violet-200 transition-colors"
          >
            <Volume2 size={16} />
            <span>إرفاق ملف صوتي (MP3 / WAV)</span>
          </label>

          {/* Live Recording Button */}
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-1.5 rounded-xl border border-amber-200 transition-colors cursor-pointer"
            >
              <Mic size={16} />
              <span>تسجيل صوت مباشر بالمايك</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl shadow-md transition-colors animate-pulse cursor-pointer"
            >
              <Square size={16} />
              <span>إيقاف وحفظ التسجيل ({formatTime(recordingTime)})</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
