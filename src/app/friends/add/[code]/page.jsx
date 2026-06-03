import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Frame, MonoLabel } from '@/components/ui/primitives'

export default async function AddFriendPage({ params }) {
  const { code } = await params
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/friends/add/${code}`)

  const userId = session.user.id

  const friendCodeRow = await prisma.friendCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { user: { select: { id: true, name: true, elo: true } } },
  })

  if (!friendCodeRow) {
    return (
      <div className="min-h-screen bg-paper px-4 py-8 flex items-center justify-center">
        <Frame className="max-w-sm w-full p-6 text-center">
          <p className="font-display text-2xl uppercase">Invalid Code</p>
          <MonoLabel className="mt-2 block">This friend code doesn't exist.</MonoLabel>
        </Frame>
      </div>
    )
  }

  if (friendCodeRow.userId === userId) {
    return (
      <div className="min-h-screen bg-paper px-4 py-8 flex items-center justify-center">
        <Frame className="max-w-sm w-full p-6 text-center">
          <p className="font-display text-2xl uppercase">That's You</p>
          <MonoLabel className="mt-2 block">You can't add yourself.</MonoLabel>
        </Frame>
      </div>
    )
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: friendCodeRow.userId },
        { requesterId: friendCodeRow.userId, addresseeId: userId },
      ],
    },
  })

  return (
    <div className="min-h-screen bg-paper px-4 py-8 flex items-center justify-center">
      <Frame className="max-w-sm w-full">
        <div className="px-6 py-5 border-b-4 border-ink text-center">
          <p className="font-display text-3xl uppercase">{friendCodeRow.user.name || 'Player'}</p>
          <MonoLabel className="mt-1 block">ELO {friendCodeRow.user.elo}</MonoLabel>
        </div>
        <div className="px-6 py-5">
          {existing ? (
            <p className="font-mono text-sm text-center">
              {existing.status === 'ACCEPTED' ? 'Already friends.' : 'Friend request already pending.'}
            </p>
          ) : (
            <Link
              href={`/api/friends/add/${code}`}
              className="block w-full bg-red text-paper font-display uppercase tracking-[0.06em] text-lg sm:text-xl px-4 py-4 text-center"
            >
              Send Friend Request →
            </Link>
          )}
        </div>
      </Frame>
    </div>
  )
}
