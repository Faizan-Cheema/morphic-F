'use client'

import { Briefcase, Check, ChevronsUpDown, DollarSign, GraduationCap, Pencil, Share2, Users } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

const MENU_ITEMS = [
	{ id: 'jobs-gigs', label: 'Jobs & Gigs', icon: Briefcase },
	{ id: 'pricing-quotes', label: 'Pricing & Quotes', icon: DollarSign },
	{ id: 'career-strategy', label: 'Career Strategy', icon: Share2 },
	{ id: 'decision-makers', label: 'Decision Makers', icon: Users },
	{ id: 'learning-skills', label: 'Learning & Skills', icon: GraduationCap },
	{ id: 'pitching-templates', label: 'Pitching & Templates', icon: Pencil },
]

export function ModelSelector() {
	const [selectedItem, setSelectedItem] = useState(MENU_ITEMS[0]) // Default to Jobs & Gigs
	const [open, setOpen] = useState(false)

	const handleSelect = (item: typeof MENU_ITEMS[0]) => {
		setSelectedItem(item)
		setOpen(false) // Close dropdown after selection
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="text-sm rounded-full shadow-none focus:ring-0 justify-between min-w-[140px]"
				>
					<div className="flex items-center space-x-2">
						<selectedItem.icon className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm font-medium">{selectedItem.label}</span>
					</div>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-64 p-2 rounded-2xl mt-4" align="start" side="bottom" avoidCollisions={false}>
				<div className="space-y-1">
					{MENU_ITEMS.map((item) => (
						<div
							key={item.id}
							onClick={() => handleSelect(item)}
							className="flex items-center space-x-3 px-3 py-2.5 hover:bg-accent rounded-md cursor-pointer transition-colors"
						>
							<item.icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
							<span className="text-sm font-medium flex-1">{item.label}</span>
							{selectedItem.id === item.id && (
								<Check className="h-4 w-4 text-primary flex-shrink-0" />
							)}
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	)
}