"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowLeft } from "lucide-react"

interface ChatHeaderProps {
  name: string
  age: number | null
  image: string | null
}

export function ChatHeader({ name, age, image }: ChatHeaderProps) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border-main bg-bg-card">
      <Link
        href="/messages"
        className="text-text-muted hover:text-text-heading transition-colors"
      >
        <ArrowLeft className="w-6 h-6" />
      </Link>

      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-bg-input flex-shrink-0 relative">
          {image ? (
            <Image
              src={image}
              alt={name}
              fill
              className="object-cover"
              sizes="40px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary-main text-primary-text text-lg font-semibold">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold text-text-heading">
            {name}
            {age && <span className="text-text-muted font-normal">, {age}</span>}
          </h2>
        </div>
      </div>
    </div>
  )
}
