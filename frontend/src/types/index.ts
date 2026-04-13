export interface BidItem {
  cltr_mng_no: string;
  pbct_cdtn_no: number;
  onbid_cltr_nm: string;
  prpt_div_nm: string;
  cltr_usg_mcls_nm: string;
  cltr_usg_scls_nm: string;
  lctn_sd_nm: string;
  lctn_sggn_nm: string;
  lctn_emd_nm: string;
  land_sqms: number | null;
  bld_sqms: number | null;
  apsl_evl_amt: number;
  lowst_bid_prc: number;
  ratio_pct: number;
  frst_ratio_pct: number | null;
  usbd_nft: number;
  pbct_nsq: string;
  pvct_trgt_yn: string;
  batc_bid_yn: string;
  alc_yn: string;
  crtn_yn: string;
  rqst_org_nm: string;
  exct_org_nm: string;
  cltr_bid_bgng_dt: string;
  cltr_bid_end_dt: string;
  thnl_img_url: string | null;
  status: "active" | "closed";
  is_bookmarked: number;
  first_collected_at: string;
  collected_at: string;
  detail_fetched_at: string | null;
  bid_fetched_at: string | null;
  loc_vnty_pscd_cont: string | null;
  utlz_pscd_cont: string | null;
  cltr_etc_cont: string | null;
  icdl_cdtn_cont: string | null;
  zadr_nm: string | null;
  cltr_radr: string | null;
  score?: number;
  score_breakdown?: {
    ratio: number;
    fail: number;
    location: number;
  };
}

export interface Stats {
  total: number;
  bookmarked: number;
  pvct_count: number;
  ratio_avg: number | null;
  ratio_min: number | null;
  ratio_below60: number;
  ratio_60_70: number;
  by_region: { lctn_sd_nm: string; cnt: number }[];
}

export interface ItemInfo {
  sqms: Record<string, unknown>[];
  apsl_evl: Record<string, unknown>[];
  paps_inf: Record<string, unknown> | null;
  crtn_lst: Record<string, unknown>[];
  batc_cltr: Record<string, unknown>[];
}

export interface BidHist {
  id: number;
  bid_qual_id: number;
  cltr_mng_no: string;
  prv_bid_seq: number;
  prv_bid_rslt: string;
  prv_bid_fail_cnt: number;
}

export interface BidQual {
  id: number;
  cltr_mng_no: string;
  pbct_cdtn_no: number;
  bid_seq: number;
  bid_strt_dttm: string;
  bid_end_dttm: string;
  bid_opnn_dttm: string;
  min_bd_prc: number;
  bid_grnt_prc: number;
  acml_fail_cnt: number;
  hist: BidHist[];
}

export interface TenantInfo {
  leas_inf: Record<string, unknown>[];
  ocpy_rel: Record<string, unknown>[];
  rgst_prmr: Record<string, unknown>[];
  dtbt_rqr: Record<string, unknown>[];
}

export interface MarketTransaction {
  dong_nm: string;
  bldg_nm: string;
  exclu_use_ar: number | null;
  deal_amount: number | null;
  floor: string;
  deal_date: string;
  unit_price: number | null;
}

export interface MarketPriceResponse {
  status: "ok" | "no_data" | "no_mapping" | "not_supported" | "api_error";
  message?: string;
  match_tier: number | null;
  match_tier_label?: string;
  match_count?: number;
  transactions: MarketTransaction[];
  summary: {
    avg_unit_price: number | null;
    estimated_market_price_won: number | null;
    latest_deal: string | null;
  } | null;
  comparison: {
    market_vs_bid_pct: number;
    discount_from_market_pct: number;
  } | null;
}

export interface FilterState {
  ratio_min: number;
  ratio_max: number;
  price_min: number | null;
  price_max: number | null;
  usbd_min: number;
  sd_nm: string;
  usg_mcls: string;
  usg_scls: string;
  bookmarked: number | null;
  pvct: "Y" | "N" | null;
  sort: "ratio" | "usbd" | "deadline";
}
