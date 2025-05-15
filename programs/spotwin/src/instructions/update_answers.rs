use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::state::contest::{Contest, ContestStatus};
use crate::state::participant::Participant;

#[derive(Accounts)]
#[instruction(contest_id: u64)]
pub struct UpdateAnswers<'info> {

    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"contest", &contest_id.to_le_bytes()[..]],
        bump = contest.contest_bump,
        has_one = creator,
        constraint = contest.status == ContestStatus::Open @ErrorCode::ContestClosed,
    )]
    pub contest: Box<Account<'info, Contest>>,

    
    /// CHECK: pure identity; used only as seed for `participant` PDA.
    /// Safe because we never read or write any lamports or data here.
    pub player: UncheckedAccount<'info>,  

    #[account(
        mut,
        seeds = [
            b"participant".as_ref(),
            &contest_id.to_le_bytes(),
            player.key().as_ref(),
        ],
        bump
    )]
    pub participant: Box<Account<'info, Participant>>,

}


pub fn handler(ctx: Context<UpdateAnswers>, contest_id: u64, new_attempt_mask: u16, new_answer_bits: u16) -> Result<()> {
    let now = Clock::get()?.slot;
    let c = &mut ctx.accounts.contest;

    require!(now < c.lock_slot, ErrorCode::ContestClosed);
    let participant = &mut ctx.accounts.participant;
    require!(
        participant.player == ctx.accounts.player.key(),
        ErrorCode::InvalidParticipant
    );
    require!(
        new_attempt_mask.count_ones() == 9,
        ErrorCode::InvalidAttemptMask
    );
    require!(
        new_answer_bits == (new_answer_bits & new_attempt_mask),
        ErrorCode::InvalidAnswerBits
    );

    let p = &mut ctx.accounts.participant;
    p.attempt_mask = new_attempt_mask;
    p.answer_bits = new_answer_bits;
    Ok(())
}    
    