import type {
  GitHubReviewComment,
  ReviewCommentThread,
} from '../lib/review-comments'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

export function GitHubReviewAnnotation({
  thread,
}: {
  thread: ReviewCommentThread
}) {
  return (
    <div
      className="mx-2 my-1.5 flex max-w-[680px] flex-col gap-2.5 rounded-control border border-line bg-surface-raised p-2.5 font-sans text-xs leading-relaxed text-foreground shadow-sm"
      data-testid="github-review-annotation"
    >
      <GitHubCommentBody comment={thread.root} />
      {thread.replies.length > 0 && (
        <div className="flex flex-col gap-2.5 border-l-2 border-line pl-2.5">
          {thread.replies.map((reply) => (
            <GitHubCommentBody key={reply.id} comment={reply} />
          ))}
        </div>
      )}
    </div>
  )
}

export function GitHubCommentBody({
  comment,
}: {
  comment: GitHubReviewComment
}) {
  const commentDateTime = formatCommentDateTime(comment.createdAt)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        {comment.author.avatarUrl !== '' && (
          <img
            className="size-4 rounded-full"
            src={comment.author.avatarUrl}
            alt=""
            loading="lazy"
          />
        )}
        <a
          className="font-medium hover:underline"
          href={comment.author.htmlUrl || undefined}
          target="_blank"
          rel="noreferrer noopener"
        >
          {comment.author.login}
        </a>
        <Tooltip>
          <TooltipTrigger
            render={
              <a
                className="text-muted-foreground hover:text-foreground hover:underline"
                href={comment.htmlUrl}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`Open comment from ${commentDateTime} on GitHub`}
              />
            }
          >
            <FormattedCommentDate isoDate={comment.createdAt} />
          </TooltipTrigger>
          <TooltipContent>{commentDateTime} · Open on GitHub</TooltipContent>
        </Tooltip>
      </div>
      <p className="whitespace-pre-wrap break-words">{comment.body}</p>
    </div>
  )
}

function FormattedCommentDate({ isoDate }: { isoDate: string }) {
  const parsed = new Date(isoDate)

  if (Number.isNaN(parsed.getTime())) {
    return <time>{isoDate}</time>
  }

  return (
    <time dateTime={isoDate}>
      {parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })}
    </time>
  )
}

function formatCommentDateTime(isoDate: string): string {
  const parsed = new Date(isoDate)
  return Number.isNaN(parsed.getTime()) ? isoDate : parsed.toLocaleString()
}
