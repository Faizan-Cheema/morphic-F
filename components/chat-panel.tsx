'use client'

import { Model } from '@/lib/types/models'
import { cn } from '@/lib/utils'
import gif from '@/public/images/party.gif'
import { Message } from 'ai'
import { ArrowUp, File, FileSliders, FileSpreadsheet, FileText, Image, Loader2, MessageCirclePlus, Mic, Plus, Square, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { EmptyScreen } from './empty-screen'
import Footer from './footer'
import { ModelSelector } from './model-selector'
import { Button } from './ui/button'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB to match backend
const ALLOWED_FILE_TYPES = [
  // Text files
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
  'text/xml',
  'application/xml',
  
  // Document files
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // Image files
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp',
  
  // Archive files
  'application/zip',
  'application/x-zip-compressed'
]

interface ChatPanelProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: Message[]
  setMessages: (messages: Message[]) => void
  query?: string
  stop: () => void
  append: (message: Message) => void
  models?: Model[]
}

// Helper function to get file type icon
const getFileIcon = (fileType: string) => {
  if (fileType.startsWith('image/')) return <Image className="size-4" />
  if (fileType.includes('pdf')) return <FileText className="size-4" />
  if (fileType.includes('word') || fileType.includes('document')) return <FileText className="size-4" />
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return <FileSpreadsheet className="size-4" />
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return <FileSliders className="size-4" />
  return <File className="size-4" />
}

// Helper function to get file type description
const getFileTypeDescription = (fileType: string) => {
  if (fileType.startsWith('image/')) return 'Image (OCR supported)'
  if (fileType.includes('pdf')) return 'PDF Document'
  if (fileType.includes('word') || fileType.includes('document')) return 'Word Document'
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'Excel Spreadsheet'
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'PowerPoint Presentation'
  if (fileType === 'text/csv') return 'CSV Data'
  if (fileType === 'application/json') return 'JSON Data'
  if (fileType.includes('text/')) return 'Text File'
  return 'Document'
}

export function ChatPanel({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  messages,
  setMessages,
  query,
  stop,
  append,
  models
}: ChatPanelProps) {
  const [showEmptyScreen, setShowEmptyScreen] = useState(false)
  const [hideFooterAndModelSelector, setHideFooterAndModelSelector] = useState(messages.length > 0);
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false)
  const [enterDisabled, setEnterDisabled] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string>('')
  const [isFileProcessing, setIsFileProcessing] = useState(false)

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  const handleNewChat = () => {
    setMessages([])
    setUploadedFile(null)
    setFileError('')
    router.push('/')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset previous errors
    setFileError('')

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setFileError(`File type "${file.type}" is not supported. Supported types include: text, images, PDF, Word, Excel, PowerPoint, CSV, JSON, and more.`)
      return
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
      return
    }

    setUploadedFile(file)
    
    // Clear the input so the same file can be uploaded again if needed
    e.target.value = ''
  }

  const handleRemoveFile = () => {
    setUploadedFile(null)
    setFileError('')
  }

  useEffect(() => {
    if (isFirstRender.current && query && query.trim().length > 0) {
      const message: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: query
      }
      append(message)
      isFirstRender.current = false
    }
  }, [query, append])

  useEffect(() => {
    setHideFooterAndModelSelector(messages.length > 0);
  }, [messages]);

  // Helper function to read streaming response
  const readStreamingResponse = async (response: Response): Promise<string> => {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let result = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += decoder.decode(value, { stream: true })
      }
      return result
    } finally {
      reader.releaseLock()
    }
  }

  const customHandleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Prevent submission if no input and no file, or if already processing
    if ((input.trim().length === 0 && !uploadedFile) || isFileProcessing) return

    if (uploadedFile) {
      setIsFileProcessing(true)
      
      try {
        // Add user message to chat immediately for better UX
        const fileTypeDesc = getFileTypeDescription(uploadedFile.type)
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: `📎 **${uploadedFile.name}** (${fileTypeDesc})\n${(uploadedFile.size / 1024).toFixed(1)}KB\n\n${input || 'Please analyze this file'}`
        }
        append(userMessage)

        // Clear input immediately
        handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>)

        // Prepare and send file upload request
        const formData = new FormData()
        formData.append('query', input || 'Please analyze this file')
        formData.append('file', uploadedFile)
        
        // Add conversation history for context (last 5 messages)
        formData.append('messages', JSON.stringify(messages.slice(-5)))

        const res = await fetch('/api/chat', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          let errorMessage = `Upload failed (${res.status})`
          
          try {
            const errorData = await res.json()
            errorMessage = errorData.error || errorMessage
            
            // Handle specific error codes from backend
            switch (errorData.code) {
              case 'INVALID_FILE_TYPE':
                errorMessage = `File type not supported. ${errorData.error}`
                break
              case 'FILE_TOO_LARGE':
                errorMessage = `File is too large. ${errorData.error}`
                break
              case 'EXTRACTION_FAILED':
                errorMessage = `Could not extract content from file. ${errorData.error}`
                break
              case 'FILE_PROCESSING_ERROR':
                errorMessage = `Error processing file. ${errorData.error}`
                break
              default:
                errorMessage = errorData.error || errorMessage
            }
          } catch {
            // If response isn't JSON, use status-based message
            if (res.status === 413) {
              errorMessage = 'File too large - please use a smaller file'
            } else if (res.status === 400) {
              errorMessage = 'Invalid file or request'
            }
          }
          
          throw new Error(errorMessage)
        }

        // Handle streaming response
        const responseText = await readStreamingResponse(res)

        // Add AI response to chat
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: responseText
        }
        append(assistantMessage)

      } catch (error) {
        console.error('Error processing file:', error)
        
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `❌ **Error processing file**: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease try again with a different file or check if the file format is supported.`
        }
        append(errorMessage)
      } finally {
        // Clean up
        setUploadedFile(null)
        setFileError('')
        setIsFileProcessing(false)
      }
    } else {
      // Handle regular text submission
      try {
        const userMessage: Message = {
          id: crypto.randomUUID(),
          role: 'user',
          content: input.trim()
        }
        append(userMessage)

        // Clear input immediately
        handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLTextAreaElement>)

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: input.trim(),
            messages: messages.slice(-5), // Last 5 messages for context
          }),
        })

        if (!res.ok) {
          let errorMessage = `Request failed (${res.status})`
          
          try {
            const errorData = await res.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            errorMessage = `Text query failed (${res.status})`
          }
          
          throw new Error(errorMessage)
        }

        // Handle streaming response
        const responseText = await readStreamingResponse(res)

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: responseText,
        }
        append(assistantMessage)
      } catch (error) {
        console.error('Error processing text query:', error)

        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `❌ **Error processing query**: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\nPlease try again.`,
        }
        append(errorMessage)
      }
    }
  }

  const isSubmitDisabled = (input.length === 0 && !uploadedFile) || isLoading || isFileProcessing

  // Generate accept string for file input
  const acceptString = ALLOWED_FILE_TYPES.join(',')

  return (
    <div
      className={cn(
        'mx-auto w-full',
        messages.length > 0
          ? 'fixed bottom-0 left-0 right-0 bg-background'
          : 'fixed bottom-8 left-0 right-0 top-6 flex flex-col items-center justify-center'
      )}
    >      
      {messages.length === 0 && (
        <div className="mb-8 flex justify-center">
          <img
            src={typeof gif === 'string' ? gif : gif.src}
            alt="Party Gif"
            className="size-28 rounded-full object-cover"
          />
        </div>
      )}
      
      <form
        onSubmit={customHandleSubmit}
        className={cn(
          'max-w-3xl w-full mx-auto',
          messages.length > 0 ? 'px-2 py-4' : 'px-6'
        )}
      >
        <div className="relative flex flex-col w-full gap-2 bg-muted rounded-3xl border border-input">
          {/* File error display */}
          {fileError && (
            <div className="px-4 pt-3 pb-1 text-xs text-destructive bg-destructive/10 rounded-t-3xl border-b border-destructive/20">
              <div className="flex items-start gap-2">
                <span className="text-destructive">⚠️</span>
                <span className="flex-1">{fileError}</span>
              </div>
            </div>
          )}
          
          {/* File preview */}
          {uploadedFile && (
            <div className="flex items-center gap-3 px-4 pt-3 pb-2 bg-accent/30 rounded-t-3xl border-b border-border/50">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getFileIcon(uploadedFile.type)}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">
                    {uploadedFile.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getFileTypeDescription(uploadedFile.type)} • {(uploadedFile.size / 1024).toFixed(1)}KB
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="flex-shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors rounded-sm hover:bg-destructive/10"
                disabled={isFileProcessing}
                title="Remove file"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          
          {/* Text input area */}
          <Textarea
            ref={inputRef}
            name="input"
            rows={2}
            maxRows={5}
            tabIndex={0}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={
              uploadedFile 
                ? `Ask about "${uploadedFile.name}"...` 
                : 'Ask a question or upload a file...'
            }
            spellCheck={false}
            value={input}
            className="resize-none w-full min-h-12 bg-transparent border-0 px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            onChange={e => {
              handleInputChange(e)
              setShowEmptyScreen(e.target.value.length === 0)
              setHideFooterAndModelSelector(e.target.value.length > 0)
            }}
            onKeyDown={e => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled &&
                !isFileProcessing
              ) {
                if (input.trim().length === 0 && !uploadedFile) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                textarea.form?.requestSubmit()
              }
            }}
            onFocus={() => setShowEmptyScreen(true)}
            onBlur={() => setShowEmptyScreen(false)}
            disabled={isFileProcessing}
          />

          {/* Bottom controls */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              {/* Conditionally render ModelSelector */}
              {!hideFooterAndModelSelector && <ModelSelector />}
              
              {/* File upload button */}
              <Button
                variant="outline"
                size="icon"
                className="rounded-full hover:bg-accent"
                type="button"
                asChild
                disabled={isFileProcessing}
                title="Upload file (Text, Images, PDF, Word, Excel, PowerPoint, CSV, JSON)"
              >
                <label className="cursor-pointer m-0 p-0">
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept={acceptString}
                    disabled={isFileProcessing}
                  />
                  <Plus className="size-4" />
                </label>
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNewChat}
                  className="shrink-0 rounded-full group hover:bg-accent"
                  type="button"
                  disabled={isLoading || isFileProcessing}
                  title="New chat"
                >
                  <MessageCirclePlus className="size-4 group-hover:rotate-12 transition-all" />
                </Button>
              )}
              
              {/* Voice input button */}
              <Button
                variant="outline"
                size="icon"
                className="rounded-full hover:bg-accent"
                type="button"
                disabled={isFileProcessing}
                title="Voice input (coming soon)"
                onClick={() => {
                  // TODO: Implement voice input functionality
                  alert('Voice input feature coming soon!')
                }}
              >
                <Mic className="size-4" />
              </Button>
              
              {/* Submit/Stop button */}
              <Button
                type={isLoading || isFileProcessing ? 'button' : 'submit'}
                size={'icon'}
                variant={'outline'}
                className={cn(
                  (isLoading || isFileProcessing) && 'animate-pulse', 
                  'rounded-full hover:bg-accent'
                )}
                disabled={isSubmitDisabled}
                onClick={(isLoading || isFileProcessing) ? stop : undefined}
                title={
                  isFileProcessing 
                    ? 'Processing file...' 
                    : isLoading 
                      ? 'Stop generation' 
                      : 'Send message'
                }
              >
                {isFileProcessing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isLoading ? (
                  <Square size={20} />
                ) : (
                  <ArrowUp size={20} />
                )}
              </Button>
            </div>
          </div>
        </div>

        {messages.length === 0 && (
          <EmptyScreen
            submitMessage={message => {
              handleInputChange({
                target: { value: message }
              } as React.ChangeEvent<HTMLTextAreaElement>)
            }}
            className={cn(showEmptyScreen ? 'visible' : 'invisible')}
          />
        )}

        {/* Conditionally render Footer */}
        {!hideFooterAndModelSelector && <Footer isVisible={!hideFooterAndModelSelector} />}
      </form>
    </div>
  )
}