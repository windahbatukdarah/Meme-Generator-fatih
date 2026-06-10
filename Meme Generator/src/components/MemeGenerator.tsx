import React, { useState, useRef, useEffect } from "react";
import { Upload, Sparkles, Download, ArrowLeft, RefreshCw, Loader2, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { MemeTemplate, DraggableText, DraggableImage } from "../types";
import { translations } from "../translations";
import { motion } from "motion/react";
import { toPng } from 'html-to-image';

export default function MemeGenerator() {
  const [language, setLanguage] = useState("English");
  const t = translations[language] || translations.English;

  const [selectedImage, setSelectedImage] = useState<{ url: string; file?: File; base64?: string } | null>(null);
  const [templates, setTemplates] = useState<MemeTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [textElements, setTextElements] = useState<DraggableText[]>([]);
  const [imageElements, setImageElements] = useState<DraggableImage[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [magicCaptions, setMagicCaptions] = useState<string[]>([]);
  const [magicError, setMagicError] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const res = await fetch("https://api.imgflip.com/get_memes");
        const json = await res.json();
        if (json.success) {
          setTemplates(json.data.memes);
        }
      } catch (err) {
        console.error("Failed to fetch templates", err);
      }
      setLoadingTemplates(false);
    };
    fetchTemplates();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage({
        url,
        file,
        base64: event.target?.result as string,
      });
      // Default initial text
      setTextElements([{ id: Date.now().toString(), text: "", color: "#ffffff", fontSize: 48 }]);
      setImageElements([]);
    };
    reader.readAsDataURL(file);
  };

  const addImageLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImageElements(prev => [
      ...prev,
      { id: Date.now().toString(), url, width: 100, height: 100 }
    ]);
  };

  const handleTemplateClick = async (template: MemeTemplate) => {
    // wsrv.nl proxy easily handles images statically so it won't break on vercel
    const proxiedUrl = `https://wsrv.nl/?url=${encodeURIComponent(template.url)}&output=webp`;
    setSelectedImage({ url: proxiedUrl });
    setTextElements([
      { id: Date.now().toString() + "_1", text: "", color: "#ffffff", fontSize: 48 },
      { id: Date.now().toString() + "_2", text: "", color: "#ffffff", fontSize: 48 }
    ]);
    setImageElements([]);
    try {
      const res = await fetch(proxiedUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage((prev) => prev ? { ...prev, base64: event.target?.result as string } : null);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.warn("Could not fetch base64 for template due to CORS. Magic Caption may be unavailable.");
    }
  };

  const generateMagicCaptions = async () => {
    if (!selectedImage?.base64) {
      setMagicError(t.magicError || "Please upload an image to use Magic Captions.");
      return;
    }

    setIsGenerating(true);
    setMagicError("");
    setMagicCaptions([]);

    try {
      const mimeMatch = selectedImage.base64.match(/data:(.*?);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

      const res = await fetch("/api/generate-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedImage.base64, mimeType, language }),
      });

      if (!res.ok) {
        throw new Error(t.formatError || "Failed to generate captions.");
      }

      const json = await res.json();
      setMagicCaptions(json.captions || []);
    } catch (err: any) {
      console.error(err);
      setMagicError(err.message || t.generalError || "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  };

  const applyMagicCaption = (caption: string) => {
    const words = caption.split(" ");
    let top = "";
    let bottom = "";
    if (words.length <= 3) {
      bottom = caption;
    } else {
      const mid = Math.floor(words.length / 2);
      top = words.slice(0, mid).join(" ");
      bottom = words.slice(mid).join(" ");
    }
    
    setTextElements([
      { id: Date.now().toString() + "_top", text: top, color: "#ffffff", fontSize: 48 },
      { id: Date.now().toString() + "_bottom", text: bottom, color: "#ffffff", fontSize: 48 }
    ]);
  };

  const updateText = (id: string, updates: Partial<DraggableText>) => {
    setTextElements(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };
  
  const updateImageLayer = (id: string, updates: Partial<DraggableImage>) => {
    setImageElements(prev => prev.map(img => img.id === id ? { ...img, ...updates } : img));
  };

  const downloadMeme = async () => {
    if (!containerRef.current) return;
    try {
      // Small timeout to ensure rendering is settled
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = await toPng(containerRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = "meme-generated.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to generate image:", err);
      alert(t.generalError || "Something went wrong.");
    }
  };

  if (!selectedImage) {
    return (
      <div className="max-w-5xl mx-auto p-6 pt-12 relative">
        <div className="absolute top-4 right-6 flex items-center gap-2">
          <label className="text-sm font-medium text-gray-500">{t.language || "Language"}:</label>
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-white border border-gray-200 text-gray-700 py-1.5 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-sm"
          >
            {Object.keys(translations).map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
        
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-4 inline-flex items-center gap-3">
            <Sparkles className="w-10 h-10 text-purple-600" />
            {t.title}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t.subtitle}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 md:p-12 mb-12 transform transition-all duration-300">
          <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 hover:border-purple-400 transition-colors group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-12 h-12 text-gray-400 mb-4 group-hover:text-purple-500 transition-colors" />
              <p className="mb-2 text-lg text-gray-700">
                <span className="font-semibold text-purple-600">{t.upload}</span> {t.dragDrop}
              </p>
              <p className="text-sm text-gray-500">PNG, JPG, WEBP (Max 10MB)</p>
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
          </label>
        </div>

        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2 text-gray-800">
              <ImageIcon className="w-6 h-6" />
              <h2 className="text-2xl font-bold">{t.trending}</h2>
            </div>
            <input
              type="text"
              placeholder={t.searchTemplates || "Search templates..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-4 py-2 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none w-full md:w-64"
            />
          </div>
          
          {loadingTemplates ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-[600px] overflow-y-auto p-1">
              {templates.filter(tmpl => tmpl.name.toLowerCase().includes(searchQuery.toLowerCase())).map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleTemplateClick(tmpl)}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition-shadow border border-gray-200"
                >
                  <img src={tmpl.url} alt={tmpl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end p-2">
                    <span className="text-white text-xs font-semibold truncate opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md">
                      {tmpl.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 relative">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => {
            setSelectedImage(null);
            setTextElements([]);
            setImageElements([]);
            setMagicCaptions([]);
          }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          <ArrowLeft className="w-5 h-5" />
          {t.back}
        </button>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-500">{t.language || "Language"}:</label>
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-white border border-gray-200 text-gray-700 py-1.5 px-3 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-sm"
          >
            {Object.keys(translations).map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
        {/* Editor Preview */}
        <div className="bg-white p-4 rounded-3xl shadow-lg border border-gray-100 flex flex-col items-center min-h-[60vh] select-none">
          <div className="w-full p-3 bg-purple-50 rounded-xl mb-4 text-sm text-purple-800 text-center font-medium border border-purple-100">
             {t.dragInstruction || "Drag text and images to position them perfectly!"}
          </div>
          
          <div 
            ref={containerRef} 
            className="relative inline-block max-w-full overflow-hidden shadow-md rounded-lg"
          >
            <img 
              src={selectedImage.url} 
              alt="Meme template" 
              className="max-h-[70vh] w-auto max-w-full object-contain block pointer-events-none"
            />
            
            {/* Draggable Images */}
            {imageElements.map(img => (
              <motion.img
                key={img.id}
                id={`draggable-img-${img.id}`}
                src={img.url}
                drag
                dragMomentum={false}
                dragConstraints={containerRef}
                className="absolute top-0 left-0 cursor-move border-2 border-transparent hover:border-blue-400 border-dashed rounded-sm touch-none"
                style={{
                   width: `${img.width}px`,
                   height: `auto`, /* objectFit: 'contain' */
                   rotate: img.rotation || 0,
                   rotateX: img.rotateX || 0,
                   rotateY: img.rotateY || 0,
                   transformPerspective: 800,
                }}
              />
            ))}

            {/* Draggable Texts */}
            {textElements.map(txt => (
              <motion.div
                key={txt.id}
                id={`draggable-text-${txt.id}`}
                drag
                dragMomentum={false}
                dragConstraints={containerRef}
                className="absolute top-0 left-0 cursor-move min-w-[50px] touch-none"
                style={{
                  color: txt.color,
                  fontSize: `${txt.fontSize}px`,
                  fontFamily: "Impact, sans-serif",
                  lineHeight: 1.15,
                  WebkitTextStroke: "2px black",
                  textShadow: "2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 2px 0 0 #000, 0 -2px 0 #000, -2px 0 0 #000",
                  textAlign: "center",
                  whiteSpace: "pre-wrap",
                  rotate: txt.rotation || 0,
                  rotateX: txt.rotateX || 0,
                  rotateY: txt.rotateY || 0,
                  transformPerspective: 800
                }}
              >
                {txt.text.toUpperCase()}
              </motion.div>
            ))}
          </div>
          
          <button 
            onClick={downloadMeme}
            className="mt-8 flex items-center gap-2 bg-gray-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
          >
            <Download className="w-5 h-5" />
            {t.download}
          </button>
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 flex flex-col gap-4">
            <h3 className="text-xl font-bold text-gray-900">{t.memeText || "Layers"}</h3>
            
            <div className="flex gap-2">
               <button 
                 onClick={() => setTextElements(p => [...p, { id: Date.now().toString(), text: "NEW TEXT", color: "#ffffff", fontSize: 48 }])}
                 className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-medium transition-colors border border-gray-200"
               >
                 <Plus className="w-4 h-4" />
                 {t.addText || "Add Text"}
               </button>
               
               <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg font-medium transition-colors border border-gray-200"
               >
                 <ImageIcon className="w-4 h-4" />
                 {t.addImage || "Add Image"}
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={addImageLayer} />
               </button>
            </div>

            <div className="max-h-[40vh] overflow-y-auto space-y-4 pr-1">
              {imageElements.map(img => (
                <div key={img.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-3 relative">
                   <button 
                     onClick={() => setImageElements(p => p.filter(i => i.id !== img.id))}
                     className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                   <p className="text-xs font-bold text-gray-500 uppercase">Image Layer</p>
                   <img src={img.url} className="h-12 w-auto max-w-[100px] object-contain rounded border pointer-events-none" />
                   <div className="flex items-center gap-4 mt-1">
                     <div className="flex-1">
                       <label className="text-xs text-gray-500 font-semibold mb-1 block">{t.size || "Size"}</label>
                       <input 
                         type="range" min="20" max="600" value={img.width} 
                         onChange={(e) => updateImageLayer(img.id, { width: +e.target.value })}
                         className="w-full accent-purple-600"
                       />
                     </div>
                     <div className="flex-1">
                       <label className="text-xs text-gray-500 font-semibold mb-1 block">{t.rotation || "Rotation"} ({(img.rotation || 0)}°)</label>
                       <div className="flex gap-2">
                         <input 
                           type="range" min="-180" max="180" value={img.rotation || 0} 
                           onChange={(e) => updateImageLayer(img.id, { rotation: +e.target.value })}
                           className="w-full accent-purple-600"
                         />
                         <input 
                           type="number" min="-180" max="180" value={img.rotation || 0}
                           onChange={(e) => updateImageLayer(img.id, { rotation: +e.target.value })}
                           className="w-16 px-1 py-0.5 text-xs rounded border border-gray-300"
                         />
                       </div>
                     </div>
                   </div>
                   <div className="flex items-center gap-4 mt-2">
                     <div className="flex-1">
                       <label className="text-xs text-gray-500 font-semibold mb-1 block">{t.perspectiveX || "Perspective X"} ({(img.rotateX || 0)}°)</label>
                       <div className="flex gap-2">
                         <input 
                           type="range" min="-180" max="180" value={img.rotateX || 0} 
                           onChange={(e) => updateImageLayer(img.id, { rotateX: +e.target.value })}
                           className="w-full accent-purple-600"
                         />
                         <input 
                           type="number" min="-180" max="180" value={img.rotateX || 0}
                           onChange={(e) => updateImageLayer(img.id, { rotateX: +e.target.value })}
                           className="w-16 px-1 py-0.5 text-xs rounded border border-gray-300"
                         />
                       </div>
                     </div>
                     <div className="flex-1">
                       <label className="text-xs text-gray-500 font-semibold mb-1 block">{t.perspectiveY || "Perspective Y"} ({(img.rotateY || 0)}°)</label>
                       <div className="flex gap-2">
                         <input 
                           type="range" min="-180" max="180" value={img.rotateY || 0} 
                           onChange={(e) => updateImageLayer(img.id, { rotateY: +e.target.value })}
                           className="w-full accent-purple-600"
                         />
                         <input 
                           type="number" min="-180" max="180" value={img.rotateY || 0}
                           onChange={(e) => updateImageLayer(img.id, { rotateY: +e.target.value })}
                           className="w-16 px-1 py-0.5 text-xs rounded border border-gray-300"
                         />
                       </div>
                     </div>
                   </div>
                </div>
              ))}

              {textElements.map((txt) => (
                <div key={txt.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-col gap-3 relative">
                   <button 
                     onClick={() => setTextElements(p => p.filter(t => t.id !== txt.id))}
                     className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                   <p className="text-xs font-bold text-gray-500 uppercase">Text Layer</p>
                   <textarea
                     value={txt.text}
                     onChange={(e) => updateText(txt.id, { text: e.target.value })}
                     placeholder="Text..."
                     rows={2}
                     className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-200 outline-none resize-none font-medium"
                   />
                   <div className="flex gap-4">
                     <div className="flex-1">
                       <label className="text-xs text-gray-500 font-semibold mb-1 block">{t.size || "Size"}</label>
                       <input 
                         type="range" min="16" max="150" value={txt.fontSize} 
                         onChange={(e) => updateText(txt.id, { fontSize: +e.target.value })}
                         className="w-full accent-purple-600"
                       />
                     </div>
                     <div className="flex-1">
                       <label className="text-xs text-gray-500 font-semibold mb-1 block">{t.rotation || "Rotation"} ({(txt.rotation || 0)}°)</label>
                       <div className="flex gap-2">
                         <input 
                           type="range" min="-180" max="180" value={txt.rotation || 0} 
                           onChange={(e) => updateText(txt.id, { rotation: +e.target.value })}
                           className="w-full accent-purple-600"
                         />
                         <input 
                           type="number" min="-180" max="180" value={txt.rotation || 0}
                           onChange={(e) => updateText(txt.id, { rotation: +e.target.value })}
                           className="w-16 px-1 py-0.5 text-xs rounded border border-gray-300"
                         />
                       </div>
                     </div>
                     <div>
                       <label className="text-xs text-gray-500 font-semibold mb-1 block">{t.color || "Color"}</label>
                       <input 
                         type="color" value={txt.color} 
                         onChange={(e) => updateText(txt.id, { color: e.target.value })}
                         className="h-6 w-full cursor-pointer"
                       />
                     </div>
                   </div>
                   <div className="flex gap-4 mt-2">
                     <div className="flex-1">
                       <label className="text-xs text-gray-500 font-semibold mb-1 block">{t.perspectiveX || "Perspective X"} ({(txt.rotateX || 0)}°)</label>
                       <div className="flex gap-2">
                         <input 
                           type="range" min="-180" max="180" value={txt.rotateX || 0} 
                           onChange={(e) => updateText(txt.id, { rotateX: +e.target.value })}
                           className="w-full accent-purple-600"
                         />
                         <input 
                           type="number" min="-180" max="180" value={txt.rotateX || 0}
                           onChange={(e) => updateText(txt.id, { rotateX: +e.target.value })}
                           className="w-16 px-1 py-0.5 text-xs rounded border border-gray-300"
                         />
                       </div>
                     </div>
                     <div className="flex-1">
                       <label className="text-xs text-gray-500 font-semibold mb-1 block">{t.perspectiveY || "Perspective Y"} ({(txt.rotateY || 0)}°)</label>
                       <div className="flex gap-2">
                         <input 
                           type="range" min="-180" max="180" value={txt.rotateY || 0} 
                           onChange={(e) => updateText(txt.id, { rotateY: +e.target.value })}
                           className="w-full accent-purple-600"
                         />
                         <input 
                           type="number" min="-180" max="180" value={txt.rotateY || 0}
                           onChange={(e) => updateText(txt.id, { rotateY: +e.target.value })}
                           className="w-16 px-1 py-0.5 text-xs rounded border border-gray-300"
                         />
                       </div>
                     </div>
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-3xl p-6 shadow-lg border border-purple-100">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <h3 className="text-xl font-bold text-purple-900">{t.magicTitle}</h3>
            </div>
            <p className="text-sm text-purple-800/80 mb-6 font-medium">
              {t.magicSub}
            </p>

            <button 
              onClick={generateMagicCaptions}
              disabled={isGenerating || !selectedImage.base64}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 rounded-xl font-bold hover:shadow-lg hover:shadow-purple-200 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t.analyzing}
                </>
              ) : !selectedImage.base64 ? (
                <>
                  <Upload className="w-5 h-5" />
                  {t.requiresImage}
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  {t.generateMagic}
                </>
              )}
            </button>

            {magicError && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                {magicError}
              </div>
            )}

            {magicCaptions.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-bold text-purple-900/60 uppercase tracking-wider mb-3">{t.suggestions || "Suggestions"}</h4>
                {magicCaptions.map((caption, idx) => (
                  <button
                    key={idx}
                    onClick={() => applyMagicCaption(caption)}
                    className="w-full text-left p-4 bg-white hover:bg-purple-50 rounded-xl border border-purple-100 shadow-sm transition-colors group"
                  >
                    <p className="text-gray-800 font-medium group-hover:text-purple-700 transition-colors">
                      {caption}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

