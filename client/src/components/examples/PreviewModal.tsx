import { useState } from 'react'
import PreviewModal from '../PreviewModal'
import { Button } from '@/components/ui/button'

export default function PreviewModalExample() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="p-8 bg-background">
      <Button onClick={() => setIsOpen(true)} data-testid="button-open-modal">
        Open Preview Modal
      </Button>
      
      <PreviewModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Modern Portfolio Preview"
        previewUrl="about:blank"
      />
    </div>
  )
}
