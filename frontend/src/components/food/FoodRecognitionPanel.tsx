import type { RefObject } from 'react'
import type { RecognitionSummary } from '../../modules/food/mealEditor'

type FoodRecognitionPanelProps = {
  fileInputRef: RefObject<HTMLInputElement>
  recognizing: boolean
  recognitionSummary: RecognitionSummary | null
  uploadedImageUrl: string | null
  onRecognize: (file: File) => void
  onSearchUnmatched: (name: string) => void
}

export function FoodRecognitionPanel(props: FoodRecognitionPanelProps) {
  const { fileInputRef, recognizing, recognitionSummary, uploadedImageUrl, onRecognize, onSearchUnmatched } = props

  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={recognizing}
        className={`food-meal-upload-trigger${recognizing ? ' is-recognizing' : ''}`}
      >
        <div className="food-meal-upload-trigger-head">
          <div>
            <div className="food-meal-upload-title">
              {recognizing ? 'Recognizing image...' : 'Upload an image to recognize foods'}
            </div>
            <div className="food-meal-upload-note">
              Click to choose a photo. We will identify foods and add matched items into the current meal draft.
            </div>
          </div>
          <div className="food-meal-upload-cta">
            {recognizing ? 'Recognizing...' : 'Choose Image'}
          </div>
        </div>
        <div className="food-meal-upload-hint">
          JPG, PNG, or other common image formats are supported.
        </div>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="food-hidden-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onRecognize(file)
        }}
      />

      {recognitionSummary ? (
        <div className="food-meal-recognition-card">
          <div className="food-meal-recognition-head">
            <div>
              <div className="food-meal-recognition-title">Latest Recognition</div>
              <div className="food-meal-recognition-file">{recognitionSummary.fileName}</div>
            </div>
            <div className="food-meal-recognition-stat">
              {recognitionSummary.matchedNames.length} matched / {recognitionSummary.unmatchedNames.length} unmatched
            </div>
          </div>

          {uploadedImageUrl ? (
            <div className="food-meal-upload-preview">
              <img className="food-meal-upload-preview-image" src={uploadedImageUrl} alt="Uploaded" />
            </div>
          ) : null}

          {recognitionSummary.recognizedNames.length > 0 ? (
            <div>
              <div className="food-meal-label-title">Recognized labels</div>
              <div className="food-chip-row">
                {recognitionSummary.recognizedNames.map((name) => (
                  <span key={`recognized-${name}`} className="food-chip food-chip--neutral">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {recognitionSummary.matchedNames.length > 0 ? (
            <div>
              <div className="food-meal-label-title">Added to meal draft</div>
              <div className="food-chip-row">
                {recognitionSummary.matchedNames.map((name) => (
                  <span key={`matched-${name}`} className="food-chip food-chip--success">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {recognitionSummary.unmatchedNames.length > 0 ? (
            <div>
              <div className="food-meal-label-title">Needs manual selection</div>
              <div className="food-chip-row">
                {recognitionSummary.unmatchedNames.map((name) => (
                  <button
                    key={`unmatched-${name}`}
                    type="button"
                    className="food-chip food-chip--warn food-chip--clickable"
                    onClick={() => onSearchUnmatched(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
