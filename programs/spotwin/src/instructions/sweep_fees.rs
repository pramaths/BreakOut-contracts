use anchor_lang::prelude::*;
use anchor_spl::token::{self, TransferChecked, TokenAccount, TokenInterface};
use crate::error::ErrorCode;
use crate::state::contest::{Contest, ContestStatus};
use crate::state::stake::StakeAccount;
use crate::constants::LOCK_PERIOD_SLOTS;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};


#[derive(Accounts)]
#[instruction(contest_id: u64)]
pub struct SweepFees<'info> {

    #[account(mut, address = creator.key() @ ErrorCode::InvalidCreator)]
    pub creator: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"contest", &contest_id.to_le_bytes()[..]],
        bump = contest.contest_bump,
        has_one = pool_mint,
        has_one = creator,
        constraint = contest.status == ContestStatus::Completed @ ErrorCode::ContestNotCompleted,
    )]
    pub contest: Box<Account<'info, Contest>>,

    #[account(
        mut,
        seeds = [b"vault", contest_id.to_le_bytes().as_ref(), pool_mint.key().as_ref()],
        bump  = contest.vault_bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

     /// CHECK: PDA authority for the vault
     #[account(
        seeds = [b"vault_authority", &contest_id.to_le_bytes()],
        bump  = contest.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = creator_ata.owner == creator.key() @ ErrorCode::InvalidOwner,
        constraint = creator_ata.mint  == pool_mint.key() @ ErrorCode::InvalidMint,
    )]
    pub creator_ata: InterfaceAccount<'info, TokenAccount>,


    pub pool_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SweepVault>, contest_id: u64) -> Result<()> {
    let balance = ctx.accounts.vault.amount;
    require!(balance > 0, ErrorCode::NothingToSweep);

    let cpi_accounts = TransferChecked {
        from:      ctx.accounts.vault.to_account_info(),
        mint:      ctx.accounts.pool_mint.to_account_info(),
        to:        ctx.accounts.creator_ata.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let seeds: &[&[&[u8]]] = &[&[
        b"vault_authority",
        &contest_id.to_le_bytes(),
        &[ctx.accounts.contest.vault_authority_bump],
    ]];

    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            seeds,
        ),
        balance,
        ctx.accounts.pool_mint.decimals,
    )?;

    Ok(())
}