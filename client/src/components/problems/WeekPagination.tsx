import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
  } from "@/components/ui/pagination"
  
  interface WeekPaginationProps {
    totalWeeks: number
    currentWeek: number
    onWeekChange: (week: number) => void
  }
  
  export default function WeekPagination({ totalWeeks, currentWeek, onWeekChange }: WeekPaginationProps) {
    return (
      <Pagination className="mt-6">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault()
                if (currentWeek > 1) onWeekChange(currentWeek - 1)
              }}
              className={currentWeek === 1 ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          {[...Array(totalWeeks)].map((_, index) => {
            const week = index + 1
            return (
              <PaginationItem key={week}>
                <PaginationLink
                  href="#"
                  isActive={week === currentWeek}
                  onClick={(e) => {
                    e.preventDefault()
                    onWeekChange(week)
                  }}
                >
                  {week}
                </PaginationLink>
              </PaginationItem>
            )
          })}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault()
                if (currentWeek < totalWeeks) onWeekChange(currentWeek + 1)
              }}
              className={currentWeek === totalWeeks ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    )
  }