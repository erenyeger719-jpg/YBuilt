import PromptInput from '../PromptInput'

export default function PromptInputExample() {
  return (
    <div className="p-8 bg-background min-h-96 flex items-center justify-center">
      <PromptInput onGenerate={(prompt) => console.log('Generated:', prompt)} />
    </div>
  )
}
