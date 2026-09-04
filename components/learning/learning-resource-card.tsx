import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  learningCategoryLabel,
  learningTypeMeta,
} from "@/lib/learning/catalog";
import type { LearningResource } from "@/lib/types";

export function LearningResourceCard({
  resource,
  showCategory = true,
}: {
  resource: LearningResource;
  showCategory?: boolean;
}) {
  const typeMeta = learningTypeMeta[resource.type];
  const TypeIcon = typeMeta.icon;

  return (
    <Link href={`/learn/${resource.slug}`} className="group block h-full">
      <Card className="h-full gap-2 transition-colors group-hover:border-primary/40">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <TypeIcon className="size-3" aria-hidden />
              {typeMeta.label}
            </Badge>
            {showCategory ? (
              <Badge variant="outline" className="text-[11px]">
                {learningCategoryLabel(resource.category)}
              </Badge>
            ) : null}
            {resource.durationMinutes ? (
              <Badge variant="outline" className="gap-1 text-[11px]">
                <Clock className="size-3" aria-hidden />
                {resource.durationMinutes} min
              </Badge>
            ) : null}
          </div>
          <CardTitle className="line-clamp-2 text-base leading-snug">
            {resource.title}
          </CardTitle>
          <CardDescription className="line-clamp-3">
            {resource.description}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
