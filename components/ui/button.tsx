import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
export const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50", { variants: { variant: { default: "bg-primary text-primary-foreground hover:bg-primary/90", secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/75", outline: "border bg-background hover:bg-muted", ghost: "hover:bg-muted", destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90" }, size: { default: "h-11 px-5", sm: "h-9 rounded-lg px-3", lg: "h-14 px-7 text-base", icon: "h-10 w-10" } }, defaultVariants: { variant: "default", size: "default" } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />);
Button.displayName = "Button";
