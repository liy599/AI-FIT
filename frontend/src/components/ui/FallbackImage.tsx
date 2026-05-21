import { useEffect, useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react'

type FallbackImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src: string | null | undefined
  fallbackSrc: string
}

export function FallbackImage({ src, fallbackSrc, onError, ...props }: FallbackImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc)

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc)
  }, [fallbackSrc, src])

  function handleError(event: SyntheticEvent<HTMLImageElement, Event>) {
    onError?.(event)
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc)
    }
  }

  return <img {...props} src={currentSrc} onError={handleError} />
}
