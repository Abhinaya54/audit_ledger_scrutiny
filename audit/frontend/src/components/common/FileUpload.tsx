import { useCallback, useState } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
}

export default function FileUpload({ onFileSelect, accept = '.csv,.xlsx' }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        setFileName(file.name);
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      onFileSelect(file);
    }
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        dragOver
          ? 'border-blue-500 bg-blue-50'
          : fileName
            ? 'border-green-400 bg-green-50'
            : 'border-slate-300 hover:border-blue-400 bg-white'
      }`}
    >
      <input type="file" accept={accept} onChange={handleChange} className="hidden" />
      {fileName ? (
        <>
          <p className="text-green-700 font-semibold">{fileName}</p>
          <p className="text-sm text-slate-500 mt-1">Click or drop to replace</p>
        </>
      ) : (
        <>
          <p className="text-slate-600 font-medium">Drop your GL file here or click to browse</p>
          <p className="text-sm text-slate-400 mt-1">Supports .csv and .xlsx</p>
        </>
      )}
    </label>
  );
}
