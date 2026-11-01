import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  X,
  Check,
  AlertTriangle,
  Info,
  Sparkles,
  Shirt,
  PencilLine,
  Plus,
  RefreshCw,
  Lightbulb
} from 'lucide-react';
import { PrimaryButton } from '../ui/PrimaryButton';
import { SecondaryButton } from '../ui/SecondaryButton';
import { GarmentImage } from '../ui/GarmentImage';
import { FormalityLevel, GarmentCategory, GarmentItem, LayeringPreference } from '../../types/wardrobe';
import { OutfitBrain, tasteGarments } from '../../services/outfitBrain';
import { runShopCheck, shopCandidate, ShopCheckResult, ShopVerdict } from '../../services/shopCheck';
import { COLOR_FAMILIES, ColorFamily } from '../../services/wardrobeSearch';
import { analyzeGarmentImageWithGemini } from '../../services/ai';
import { fileToOptimizedJpegDataUrl } from '../../services/imageResize';

/**
 * Shop Check (2026-11-01) — the raised camera button in the middle of the nav.
 * Web twin of mobile/src/components/ShopCheckModal.tsx: snap or pick a photo
 * of a piece you're thinking of buying → the AI garment scan reads it → the
 * shared engine (services/shopCheck.ts) shows what YOU own that goes with
 * it, whole outfits, Style DNA fit, near-twins, tips and a verdict. Nothing
 * is added to the wardrobe unless the user says they bought it.
 */

interface ShopCheckModalProps {
  onClose: () => void;
  wardrobe: GarmentItem[];
  brain?: OutfitBrain;
  layeringPreference?: LayeringPreference;
  stylePreferences?: string[];
  /** "I bought it — add to my wardrobe". */
  onAddGarment: (garment: GarmentItem) => void;
}

type Step = 'pick' | 'scanning' | 'describe' | 'result';

interface Described {
  name: string;
  category: GarmentCategory;
  subcategory: string;
  color: string;
  hexColor: string;
  fabric: string;
  fit: string;
  formality: FormalityLevel;
  style?: string;
  layeringRole?: GarmentItem['layeringRole'];
  tags?: string[];
  pairingNotes?: string;
}

const CATEGORIES: { key: GarmentCategory; label: string; typeHint: string }[] = [
  { key: 'tops', label: 'Top', typeHint: 'T-shirt, shirt, kurta…' },
  { key: 'bottoms', label: 'Bottom', typeHint: 'Jeans, chinos, skirt…' },
  { key: 'outerwear', label: 'Layer', typeHint: 'Jacket, blazer, coat…' },
  { key: 'shoes', label: 'Footwear', typeHint: 'Sneakers, loafers…' },
  { key: 'accessories', label: 'Accessory', typeHint: 'Bag, cap, watch…' }
];

const OCCASIONS: { key: FormalityLevel; label: string }[] = [
  { key: 'casual', label: 'Casual' },
  { key: 'smart_casual', label: 'Smart casual' },
  { key: 'formal', label: 'Formal' },
  { key: 'evening', label: 'Party' }
];

const OCCASION_LABEL: Record<FormalityLevel, string> = {
  casual: 'Casual', smart_casual: 'Smart casual', formal: 'Formal', evening: 'Party'
};
const CATEGORY_LABEL: Record<GarmentCategory, string> = {
  tops: 'Top', bottoms: 'Bottom', outerwear: 'Layer', shoes: 'Footwear', accessories: 'Accessory'
};

const VERDICT_STYLE: Record<ShopVerdict, { bg: string; fg: string }> = {
  great: { bg: 'rgba(92, 122, 82, 0.14)', fg: 'var(--color-success)' },
  good: { bg: 'var(--color-primary-alpha)', fg: 'var(--color-primary)' },
  think_twice: { bg: 'rgba(168, 73, 59, 0.12)', fg: 'var(--color-danger)' },
  unknown: { bg: 'var(--color-surface-subtle)', fg: 'var(--color-text-secondary)' }
};

export const ShopCheckModal: React.FC<ShopCheckModalProps> = ({
  onClose,
  wardrobe,
  brain,
  layeringPreference,
  stylePreferences,
  onAddGarment
}) => {
  const [step, setStep] = useState<Step>('pick');
  const [photo, setPhoto] = useState<string | null>(null);
  const [described, setDescribed] = useState<Described | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const runRef = useRef(0);

  const [formCategory, setFormCategory] = useState<GarmentCategory>('tops');
  const [formType, setFormType] = useState('');
  const [formFamily, setFormFamily] = useState<ColorFamily | null>(null);
  const [formColorName, setFormColorName] = useState('');
  const [formOccasion, setFormOccasion] = useState<FormalityLevel>('casual');

  const result: ShopCheckResult | null = useMemo(() => {
    if (!described) return null;
    const candidate = shopCandidate({ ...described, imageUrl: photo ?? '' });
    return runShopCheck(candidate, wardrobe, {
      brain,
      layeringPreference,
      stylePreferences,
      taste: brain ? tasteGarments(brain, wardrobe) : []
    });
  }, [described, photo, wardrobe, brain, layeringPreference, stylePreferences]);

  const reset = () => {
    runRef.current += 1;
    setStep('pick');
    setPhoto(null);
    setDescribed(null);
    setNotice(null);
    setAdded(false);
    setFormType('');
    setFormFamily(null);
    setFormColorName('');
    setFormCategory('tops');
    setFormOccasion('casual');
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const run = ++runRef.current;
    try {
      const dataUrl = await fileToOptimizedJpegDataUrl(file);
      if (runRef.current !== run) return;
      setPhoto(dataUrl);
      setAdded(false);
      setStep('scanning');
      const scan = await analyzeGarmentImageWithGemini(dataUrl);
      if (runRef.current !== run) return;
      const next: Described = {
        name: scan.name,
        category: scan.category,
        subcategory: scan.subcategory,
        color: scan.color,
        hexColor: scan.hexColor,
        fabric: scan.fabric,
        fit: scan.fit,
        formality: scan.formality,
        style: scan.style,
        layeringRole: scan.layeringRole,
        tags: scan.tags,
        pairingNotes: scan.pairingNotes || undefined
      };
      if (scan.aiAnalyzed === false) {
        // Only a colour guess from the pixels — let the user confirm it.
        setDescribed(next);
        prefillForm(next);
        setNotice("The AI couldn't read this photo right now. Check the details below and CLOSIQ will still compare it with your wardrobe.");
        setStep('describe');
      } else {
        setNotice(null);
        setDescribed(next);
        setStep('result');
      }
    } catch {
      if (runRef.current !== run) return;
      setNotice("Couldn't load that photo. Describe the piece instead and CLOSIQ will still check it.");
      setStep('describe');
    }
  };

  const prefillForm = (d: Described) => {
    setFormCategory(d.category);
    setFormType(d.subcategory);
    setFormColorName(d.color);
    setFormFamily(null);
    setFormOccasion(d.formality);
  };

  const handleCheckDescribed = () => {
    const family = COLOR_FAMILIES.find((f) => f.value === formFamily);
    const colourName = formColorName.trim() || family?.label.split(' ')[0] || '';
    if (!colourName) {
      setNotice('Pick the closest colour so CLOSIQ can match it.');
      return;
    }
    const type = formType.trim() || CATEGORIES.find((c) => c.key === formCategory)!.label;
    const base = described && described.category === formCategory ? described : null;
    setDescribed({
      name: `${colourName} ${type}`.replace(/\s+/g, ' ').trim(),
      category: formCategory,
      subcategory: type,
      color: colourName,
      hexColor: family?.hex ?? (base && base.color.toLowerCase() === colourName.toLowerCase() ? base.hexColor : '#9E9E9E'),
      fabric: base?.fabric ?? '',
      fit: base?.fit ?? '',
      formality: formOccasion,
      style: base?.style,
      layeringRole: formCategory === 'outerwear' ? 'outer_layer' : base?.layeringRole,
      tags: base?.tags ?? [],
      pairingNotes: base?.pairingNotes
    });
    setNotice(null);
    setStep('result');
  };

  const handleBought = () => {
    if (!described || added) return;
    onAddGarment({
      id: `user-upload-${Date.now()}`,
      name: described.name,
      category: described.category,
      subcategory: described.subcategory,
      color: described.color,
      hexColor: described.hexColor,
      fabric: described.fabric || 'Unspecified',
      fit: described.fit || undefined,
      formality: described.formality,
      layeringRole: described.layeringRole,
      style: described.style,
      seasons: ['spring', 'summer', 'autumn', 'winter'],
      imageUrl: photo ?? '',
      favorite: false,
      wearCount: 0,
      dateAdded: new Date().toISOString().split('T')[0],
      tags: described.tags ?? [],
      pairingNotes: described.pairingNotes
    });
    setAdded(true);
  };

  return (
    <div
      className="animate-fade-in sheet-backdrop"
      onClick={onClose}
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
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shop Check"
        className="animate-slide-up sheet"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: '92vh',
          overflowY: 'auto',
          backgroundColor: 'var(--color-bg)',
          borderTopLeftRadius: 'var(--radius-xl)',
          borderTopRightRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border)',
          padding: '18px 20px 28px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={iconDot}>
              <Camera size={15} />
            </span>
            <h2 className="text-section-heading" style={{ margin: 0 }}>Shop Check</h2>
          </div>
          <button onClick={onClose} aria-label="Close Shop Check" style={plainButton}>
            <X size={22} color="var(--color-text-muted)" />
          </button>
        </div>

        {step === 'pick' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ ...heroCircle }}>
                <Camera size={32} />
              </div>
              <h3 className="text-screen-heading" style={{ fontSize: '1.4rem' }}>Will it work with your wardrobe?</h3>
              <p className="text-body" style={{ marginTop: 8 }}>
                Spotted something in a shop? Snap it before you buy. CLOSIQ tells you what you already own that goes with it,
                the outfits it makes, and whether it suits your style.
              </p>
            </div>
            <label style={{ display: 'block' }}>
              <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
              <span style={{ ...primaryLike }}>
                <Camera size={18} /> Scan with camera
              </span>
            </label>
            <label style={{ display: 'block', marginTop: 10 }}>
              <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
              <span style={{ ...secondaryLike }}>
                <ImageIcon size={18} /> Choose a photo
              </span>
            </label>
            <button onClick={() => setStep('describe')} style={{ ...linkButton, margin: '16px auto 0' }}>
              <PencilLine size={14} /> No photo? Describe it instead
            </button>
            <div style={{ ...card, marginTop: 24 }}>
              {[
                'Point the camera at the piece — hanger or shelf is fine.',
                'CLOSIQ reads its type, colour and style.',
                'See what YOUR clothes pair with it, before you pay.'
              ].map((line, i) => (
                <div key={line} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: i ? 10 : 0 }}>
                  <span style={stepNum}>{i + 1}</span>
                  <span style={{ fontSize: '0.85rem' }}>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'scanning' && (
          <div style={{ textAlign: 'center', paddingTop: 12 }}>
            {photo && <img src={photo} alt="The piece being checked" style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 'var(--radius-lg)' }} />}
            <div className="text-section-heading" style={{ marginTop: 18 }}>Reading the garment…</div>
            <p className="text-body" style={{ marginTop: 6 }}>
              Working out its type, colour and style, then checking it against your wardrobe.
            </p>
            <button onClick={reset} style={{ ...linkButton, margin: '14px auto 0' }}>Cancel</button>
          </div>
        )}

        {step === 'describe' && (
          <div>
            {photo && (
              <img src={photo} alt="The piece being checked" style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 'var(--radius-md)', display: 'block', margin: '0 auto 12px' }} />
            )}
            {notice && (
              <div style={{ ...card, display: 'flex', gap: 8, borderLeft: '3px solid var(--color-primary)', marginBottom: 6 }}>
                <Info size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: '0.82rem', lineHeight: 1.45 }}>{notice}</span>
              </div>
            )}
            <FormLabel>What is it?</FormLabel>
            <ChipRow>
              {CATEGORIES.map((c) => (
                <Chip key={c.key} label={c.label} selected={formCategory === c.key} onClick={() => setFormCategory(c.key)} />
              ))}
            </ChipRow>
            <input
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              placeholder={`Type (optional) — ${CATEGORIES.find((c) => c.key === formCategory)?.typeHint}`}
              style={textInput}
            />
            <FormLabel>Colour</FormLabel>
            <ChipRow>
              {COLOR_FAMILIES.map((f) => (
                <Chip
                  key={f.value}
                  label={f.label.split(' ')[0]}
                  hex={f.hex}
                  selected={formFamily === f.value}
                  onClick={() => {
                    setFormFamily(f.value);
                    setFormColorName('');
                  }}
                />
              ))}
            </ChipRow>
            <input
              value={formColorName}
              onChange={(e) => setFormColorName(e.target.value)}
              placeholder="Exact shade (optional) — e.g. Light Yellow"
              style={textInput}
            />
            <FormLabel>How dressy is it?</FormLabel>
            <ChipRow>
              {OCCASIONS.map((o) => (
                <Chip key={o.key} label={o.label} selected={formOccasion === o.key} onClick={() => setFormOccasion(o.key)} />
              ))}
            </ChipRow>
            <PrimaryButton fullWidth icon={<Sparkles size={18} />} onClick={handleCheckDescribed} style={{ marginTop: 22 }}>
              Check it against my wardrobe
            </PrimaryButton>
            <button onClick={reset} style={{ ...linkButton, margin: '14px auto 0' }}>Start over</button>
          </div>
        )}

        {step === 'result' && described && result && (
          <ResultView
            described={described}
            photo={photo}
            result={result}
            added={added}
            onEdit={() => {
              prefillForm(described);
              setStep('describe');
            }}
            onBought={handleBought}
            onScanAnother={reset}
          />
        )}
      </div>
    </div>
  );
};

const ResultView: React.FC<{
  described: Described;
  photo: string | null;
  result: ShopCheckResult;
  added: boolean;
  onEdit: () => void;
  onBought: () => void;
  onScanAnother: () => void;
}> = ({ described, photo, result, added, onEdit, onBought, onScanAnother }) => {
  const verdict = VERDICT_STYLE[result.verdict];
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
        <PieceThumb photo={photo} hex={described.hexColor} size={84} />
        <div style={{ flex: 1 }}>
          <div className="text-section-heading" style={{ fontSize: '1.1rem' }}>{described.name}</div>
          <div className="text-caption" style={{ marginTop: 3 }}>
            {CATEGORY_LABEL[described.category]} · {described.color} · {OCCASION_LABEL[described.formality]}
          </div>
          <button onClick={onEdit} style={{ ...linkButton, marginTop: 8 }}>
            <PencilLine size={13} /> Not right? Edit details
          </button>
        </div>
      </div>

      <div style={{ borderRadius: 'var(--radius-lg)', padding: 16, marginBottom: 14, backgroundColor: verdict.bg }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: verdict.fg, fontFamily: 'var(--font-display)' }}>{result.verdictTitle}</div>
        {result.verdictSummary && <p style={{ fontSize: '0.86rem', marginTop: 6, lineHeight: 1.45 }}>{result.verdictSummary}</p>}
        <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
          {result.points.map((p) => (
            <div key={p.text} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.83rem', lineHeight: 1.4 }}>
              {p.tone === 'good' ? (
                <Check size={15} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 1 }} />
              ) : p.tone === 'warn' ? (
                <AlertTriangle size={15} color="var(--color-danger)" style={{ flexShrink: 0, marginTop: 1 }} />
              ) : (
                <Info size={15} color="var(--color-text-secondary)" style={{ flexShrink: 0, marginTop: 1 }} />
              )}
              <span>{p.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={eyebrow}>STYLE DNA</div>
        <div style={{ fontWeight: 700, marginTop: 4 }}>{result.styleFit.title}</div>
        <p className="text-body" style={{ marginTop: 4 }}>{result.styleFit.detail}</p>
      </div>

      {result.wearWith.map((group) => (
        <section key={group.category} style={{ marginBottom: 18 }}>
          <div className="text-section-heading" style={{ fontSize: '1rem' }}>{group.title}</div>
          <p className="text-body" style={{ marginTop: 3 }}>{group.sentence}</p>
          {group.suggestions.length > 0 && (
            <div className="hide-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingTop: 10 }}>
              {group.suggestions.map((s) => (
                <div key={s.item.id} style={pairCard}>
                  <div style={{ width: '100%', height: 96, borderRadius: 'var(--radius-sm, 8px)', overflow: 'hidden', backgroundColor: 'var(--color-surface-subtle)' }}>
                    <GarmentImage src={s.item.imageUrl} alt={s.item.name} category={s.item.category} hexColor={s.item.hexColor} />
                  </div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, marginTop: 6 }}>{s.item.name}</div>
                  <div className="text-caption" style={{ marginTop: 2 }}>{s.reason}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}

      {result.outfits.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <div className="text-section-heading" style={{ fontSize: '1rem' }}>Outfits you could wear</div>
          <p className="text-body" style={{ marginTop: 3 }}>With this piece and clothes you already own.</p>
          {result.outfits.map((o) => (
            <div key={o.id} style={{ ...card, marginTop: 10 }}>
              <div style={{ ...eyebrow, marginBottom: 8 }}>{o.label.toUpperCase()}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <div style={outfitPiece}>
                  <PieceThumb photo={photo} hex={described.hexColor} size={64} />
                  <span className="text-caption" style={{ marginTop: 4 }}>This piece</span>
                </div>
                {o.items.map((i) => (
                  <React.Fragment key={i.id}>
                    <Plus size={14} color="var(--color-text-muted)" />
                    <div style={outfitPiece}>
                      <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', overflow: 'hidden', backgroundColor: 'var(--color-surface-subtle)' }}>
                        <GarmentImage src={i.imageUrl} alt={i.name} category={i.category} hexColor={i.hexColor} />
                      </div>
                      <span className="text-caption" style={{ marginTop: 4, maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: 8 }}>{o.reason}</div>
            </div>
          ))}
        </section>
      )}

      {result.similarOwned.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <div className="text-section-heading" style={{ fontSize: '1rem' }}>You already own</div>
          <div className="hide-scrollbar" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingTop: 8 }}>
            {result.similarOwned.map((i) => (
              <div key={i.id} style={pairCard}>
                <div style={{ width: '100%', height: 96, borderRadius: 'var(--radius-sm, 8px)', overflow: 'hidden', backgroundColor: 'var(--color-surface-subtle)' }}>
                  <GarmentImage src={i.imageUrl} alt={i.name} category={i.category} hexColor={i.hexColor} />
                </div>
                <div style={{ fontSize: '0.76rem', fontWeight: 700, marginTop: 6 }}>{i.name}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Lightbulb size={15} color="var(--color-primary)" />
          <span style={eyebrow}>STYLIST TIPS</span>
        </div>
        {result.stylingTips.map((tip) => (
          <p key={tip} style={{ fontSize: '0.84rem', lineHeight: 1.45, marginTop: 4 }}>• {tip}</p>
        ))}
        {result.lookFor && <p className="text-caption" style={{ fontStyle: 'italic', marginTop: 10 }}>{result.lookFor}</p>}
      </div>

      <PrimaryButton
        fullWidth
        icon={added ? <Check size={18} /> : <Shirt size={18} />}
        onClick={onBought}
        disabled={added}
        style={added ? { backgroundColor: 'var(--color-success)' } : undefined}
      >
        {added ? 'Added to your wardrobe' : 'I bought it — add to my wardrobe'}
      </PrimaryButton>
      <SecondaryButton fullWidth icon={<RefreshCw size={16} />} onClick={onScanAnother} style={{ marginTop: 10 }}>
        Check another piece
      </SecondaryButton>
    </div>
  );
};

const PieceThumb: React.FC<{ photo: string | null; hex: string; size: number }> = ({ photo, hex, size }) =>
  photo ? (
    <img src={photo} alt="The piece being checked" style={{ width: size, height: size, objectFit: 'cover', borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      <span style={{ width: size / 2, height: size / 2, borderRadius: '50%', backgroundColor: hex, border: '1px solid rgba(0,0,0,0.12)' }} />
    </div>
  );

const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ ...eyebrow, color: 'var(--color-text-primary)', marginTop: 18, marginBottom: 8 }}>{children}</div>
);

const ChipRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{children}</div>
);

const Chip: React.FC<{ label: string; selected: boolean; onClick: () => void; hex?: string }> = ({ label, selected, onClick, hex }) => (
  <button
    onClick={onClick}
    aria-pressed={selected}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 12px',
      borderRadius: 'var(--radius-pill)',
      fontSize: '0.78rem',
      fontWeight: 600,
      cursor: 'pointer',
      backgroundColor: selected ? 'var(--color-primary)' : 'var(--color-surface)',
      color: selected ? 'var(--color-text-on-primary)' : 'var(--color-text-primary)',
      border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`
    }}
  >
    {hex && <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: hex, border: '1px solid rgba(0,0,0,0.15)' }} />}
    {label}
  </button>
);

const plainButton: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' };
const linkButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'var(--color-primary)',
  fontSize: '0.82rem',
  fontWeight: 700
};
const card: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 14
};
const eyebrow: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--color-primary)' };
const iconDot: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  backgroundColor: 'var(--color-primary-alpha)',
  color: 'var(--color-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
const heroCircle: React.CSSProperties = {
  width: 76,
  height: 76,
  borderRadius: '50%',
  margin: '0 auto 14px',
  backgroundColor: 'var(--color-primary)',
  color: 'var(--color-text-on-primary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
const primaryLike: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '14px 24px',
  borderRadius: 'var(--radius-pill)',
  backgroundColor: 'var(--color-primary)',
  color: 'var(--color-text-on-primary)',
  fontSize: '0.88rem',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: 'var(--shadow-sm)'
};
const secondaryLike: React.CSSProperties = {
  ...primaryLike,
  backgroundColor: 'var(--color-surface)',
  color: 'var(--color-primary)',
  border: '1px solid var(--color-border-medium)',
  boxShadow: 'none'
};
const stepNum: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  flexShrink: 0,
  backgroundColor: 'var(--color-primary-alpha)',
  color: 'var(--color-primary)',
  fontSize: '0.75rem',
  fontWeight: 800,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
const textInput: React.CSSProperties = {
  width: '100%',
  marginTop: 10,
  padding: '11px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-medium)',
  backgroundColor: 'var(--color-surface-elevated)',
  color: 'var(--color-text-primary)',
  fontSize: '0.85rem',
  outline: 'none'
};
const pairCard: React.CSSProperties = {
  width: 118,
  flexShrink: 0,
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  padding: 8
};
const outfitPiece: React.CSSProperties = { width: 70, display: 'flex', flexDirection: 'column', alignItems: 'center' };
