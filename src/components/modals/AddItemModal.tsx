import React, { useEffect, useState } from 'react';
import { X, Camera, Upload, Sparkles, Check, AlertTriangle } from 'lucide-react';
import { GarmentItem, GarmentCategory, FormalityLevel, LayeringRole, WardrobeProfile } from '../../types/wardrobe';
import { getQuickAddSamples, CatalogEntry } from '../../data/garmentCatalog';
import { analyzeCatalogGarment, VisionAnalysisResult } from '../../services/aiVisionScanner';
import { analyzeGarmentImageWithGemini } from '../../services/ai';
import { GarmentImage } from '../ui/GarmentImage';
import { PrimaryButton } from '../ui/PrimaryButton';
import { CategoryChip } from '../ui/CategoryChip';

interface AddItemModalProps {
  wardrobeProfile: WardrobeProfile;
  onClose: () => void;
  onAddGarment: (item: GarmentItem) => void;
}

type Step = 'options' | 'scanning' | 'confirm' | 'error';

/**
 * Reads the file as a base64 data URL rather than URL.createObjectURL — a
 * blob: URL is only valid for this page session, so after any reload the
 * uploaded photo would silently break (even though the stale URL string is
 * still sitting in localStorage). A data URL survives serialization/reload.
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

const SCAN_CAPTIONS = ['Detecting category…', 'Reading color & texture…', 'Finalizing details…'];

const UPLOAD_CATEGORY_OPTIONS: { key: GarmentCategory; label: string }[] = [
  { key: 'tops', label: 'Tops' },
  { key: 'bottoms', label: 'Bottoms' },
  { key: 'shoes', label: 'Footwear' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'accessories', label: 'Accessories' }
];

export const AddItemModal: React.FC<AddItemModalProps> = ({ wardrobeProfile, onClose, onAddGarment }) => {
  const quickAddSamples = getQuickAddSamples(wardrobeProfile);

  const [step, setStep] = useState<Step>('options');
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [captionIndex, setCaptionIndex] = useState(0);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<GarmentCategory>('tops');
  const [subcategory, setSubcategory] = useState('');
  const [color, setColor] = useState('');
  const [hexColor, setHexColor] = useState('#3A3F47');
  const [fabric, setFabric] = useState('');
  const [fit, setFit] = useState('Regular');
  const [layeringRole, setLayeringRole] = useState<LayeringRole | undefined>(undefined);
  const [formality, setFormality] = useState<FormalityLevel>('smart_casual');
  const [tags, setTags] = useState<string[]>([]);
  const [pairingNotes, setPairingNotes] = useState('');
  const [aiConfidence, setAiConfidence] = useState(0.95);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (step !== 'scanning') return;
    const interval = setInterval(() => {
      setCaptionIndex((prev) => (prev + 1) % SCAN_CAPTIONS.length);
    }, 700);
    return () => clearInterval(interval);
  }, [step]);

  const applyAnalysis = (result: VisionAnalysisResult) => {
    setName(result.name);
    setCategory(result.category);
    setSubcategory(result.subcategory);
    setColor(result.color);
    setHexColor(result.hexColor);
    setFabric(result.fabric);
    setFit(result.fit);
    setLayeringRole(result.layeringRole);
    setFormality(result.formality);
    setTags(result.tags);
    setPairingNotes(result.pairingNotes);
    setAiConfidence(result.aiConfidence);
    setStep('confirm');
  };

  const handleSelectSample = async (entry: CatalogEntry) => {
    setSelectedImage(entry.imagePath);
    setCaptionIndex(0);
    setStep('scanning');
    try {
      const result = await analyzeCatalogGarment(entry);
      applyAnalysis(result);
    } catch {
      setErrorMessage("We couldn't analyze that piece. Please try again.");
      setStep('error');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file (e.g. after an error) still fires onChange.
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('That file doesn’t look like an image. Please choose a photo instead.');
      setStep('error');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedImage(dataUrl);
      setCaptionIndex(0);
      setStep('scanning');

      const result = await analyzeGarmentImageWithGemini(dataUrl, category);
      applyAnalysis(result);
    } catch {
      setErrorMessage("We couldn't process that photo. Please try again with a different image.");
      setStep('error');
    }
  };

  const handleConfirmAdd = () => {
    if (!name.trim()) return;
    const newItem: GarmentItem = {
      id: `garment-${Date.now()}`,
      name,
      category,
      subcategory,
      color,
      hexColor,
      fabric,
      fit,
      layeringRole,
      seasons: ['spring', 'autumn'],
      formality,
      imageUrl: selectedImage,
      brand: 'Personal Wardrobe',
      favorite: false,
      wearCount: 0,
      dateAdded: new Date().toISOString().split('T')[0],
      tags,
      aiConfidence,
      pairingNotes
      // Deliberately no `profile`/`isSeedItem` — user-added items always
      // stay visible regardless of which wardrobe profile is active later.
    };

    onAddGarment(newItem);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center'
      }}
      className="animate-fade-in"
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: 'var(--color-surface)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          padding: 24,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)'
        }}
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="text-section-heading">
            {step === 'options'
              ? 'Add to Collection'
              : step === 'scanning'
              ? 'AI Analysis'
              : step === 'error'
              ? 'Something Went Wrong'
              : 'Confirm Garment Details'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* STEP 1: OPTIONS */}
        {step === 'options' && (
          <div>
            <div className="text-metadata" style={{ marginBottom: 10 }}>
              What are you adding?
            </div>
            <div className="hide-scrollbar" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 20 }}>
              {UPLOAD_CATEGORY_OPTIONS.map((opt) => (
                <CategoryChip
                  key={opt.key}
                  label={opt.label}
                  active={category === opt.key}
                  onClick={() => setCategory(opt.key)}
                />
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
              <label
                style={{
                  padding: 20,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Camera size={24} color="var(--color-primary)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Take Photo</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>

              <label
                style={{
                  padding: 20,
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-surface-subtle)',
                  border: '1px solid var(--color-border)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Upload size={24} color="var(--color-primary)" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Upload Photo</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </div>

            <div className="text-metadata" style={{ marginBottom: 10 }}>
              Or choose a sample piece to scan
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {quickAddSamples.map((entry) => (
                <div
                  key={entry.id}
                  onClick={() => handleSelectSample(entry)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 8,
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface-subtle)',
                    border: '1px solid var(--color-border)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                    <GarmentImage
                      src={entry.imagePath}
                      alt={entry.name}
                      category={entry.category}
                      hexColor={entry.hexColor}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{entry.color} · {entry.category}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ERROR STEP: upload or AI analysis failed — never leave the scanning spinner stuck */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'rgba(217, 83, 79, 0.12)',
                color: '#D9534F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}
            >
              <AlertTriangle size={26} />
            </div>
            <p className="text-body" style={{ fontSize: '0.88rem', marginBottom: 20 }}>{errorMessage}</p>
            <PrimaryButton
              fullWidth
              onClick={() => {
                setErrorMessage('');
                setSelectedImage('');
                setStep('options');
              }}
            >
              Try Again
            </PrimaryButton>
          </div>
        )}

        {/* STEP 2: AI SCANNING */}
        {step === 'scanning' && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 220,
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                marginBottom: 20,
                backgroundColor: 'var(--color-surface-subtle)'
              }}
            >
              <GarmentImage src={selectedImage} alt="Garment being analyzed" category={category} hexColor={hexColor} />
              <div className="scan-shimmer-overlay" />
            </div>

            <div
              className="animate-pulse-glow"
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-alpha)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}
            >
              <Sparkles size={26} />
            </div>

            <h3 className="text-section-heading" style={{ fontSize: '1.2rem', marginBottom: 4 }}>
              Understanding your garment...
            </h3>
            <p key={captionIndex} className="text-body animate-count-up" style={{ fontSize: '0.85rem' }}>
              {SCAN_CAPTIONS[captionIndex]}
            </p>
          </div>
        )}

        {/* STEP 3: CONFIRMATION & EDIT FORM */}
        {step === 'confirm' && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: 10, backgroundColor: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                <GarmentImage src={selectedImage} alt="Garment" category={category} hexColor={hexColor} />
              </div>
              <div style={{ minWidth: 0 }}>
                <span className="text-metadata" style={{ color: 'var(--color-primary)' }}>
                  AI Auto-Detected · {Math.round(aiConfidence * 100)}% confidence
                </span>
                <div style={{ fontSize: '0.92rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Category: {category} · Color: {color}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <label className="text-metadata" style={{ display: 'block', marginBottom: 4 }}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-medium)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                <div>
                  <label className="text-metadata" style={{ display: 'block', marginBottom: 4 }}>Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-medium)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                  >
                    <option value="tops">Tops</option>
                    <option value="bottoms">Bottoms</option>
                    <option value="shoes">Footwear</option>
                    <option value="outerwear">Outerwear</option>
                    <option value="accessories">Accessories</option>
                  </select>
                </div>

                <div>
                  <label className="text-metadata" style={{ display: 'block', marginBottom: 4 }}>Color</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-medium)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleConfirmAdd}
              disabled={!name.trim()}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.88rem',
                fontWeight: 600,
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-on-primary)',
                border: 'none',
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                opacity: name.trim() ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <Check size={18} /> Confirm & Add to Collection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
