"use client";

interface SkeletonCardProps {
  aspectRatio?: string;
}

export default function SkeletonCard({ aspectRatio = "4/3" }: SkeletonCardProps) {
  return (
    <div
      data-testid="skeleton-card"
      className="animate-pulse bg-gray-200 rounded w-full"
      style={{ aspectRatio }}
    />
  );
}
